import logging
from typing import Optional, List, Dict, Any
import httpx

from backend.app.github.authentication import GitHubConfig

logger = logging.getLogger("coframe.github.client")


class GitHubError(Exception):
    def __init__(self, message: str, status_code: Optional[int] = None, response_body: Optional[Any] = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.response_body = response_body


class GitHubAuthError(GitHubError):
    pass


class GitHubPermissionError(GitHubError):
    pass


class GitHubNotFoundError(GitHubError):
    pass


class GitHubConflictError(GitHubError):
    pass


class GitHubValidationError(GitHubError):
    pass


class GitHubRateLimitError(GitHubError):
    pass


class GitHubNetworkError(GitHubError):
    pass


class GitHubClient:
    def __init__(
        self,
        token: Optional[str] = None,
        base_url: str = "https://api.github.com",
        transport: Optional[httpx.AsyncBaseTransport] = None,
        timeout: float = 15.0,
    ):
        self.token = token or GitHubConfig.get_token()
        self.base_url = base_url.rstrip("/")
        self.transport = transport
        self.timeout = timeout

    def _get_headers(self) -> Dict[str, str]:
        headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "COFRAME-Collaboration-Engine/1.0",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def _handle_response(self, response: httpx.Response) -> Any:
        status = response.status_code
        if 200 <= status < 300:
            return response.json() if response.content else {}

        error_data = None
        try:
            error_data = response.json()
        except Exception:
            error_data = response.text

        msg = f"GitHub API error {status}: {error_data}"

        if status == 401:
            raise GitHubAuthError("GitHub authentication failed. Please verify GITHUB_TOKEN.", status, error_data)
        elif status == 403:
            if "rate limit" in str(error_data).lower():
                raise GitHubRateLimitError("GitHub API rate limit exceeded.", status, error_data)
            raise GitHubPermissionError("Insufficient permissions for this GitHub repository.", status, error_data)
        elif status == 404:
            raise GitHubNotFoundError("Requested GitHub repository or resource not found.", status, error_data)
        elif status == 409:
            raise GitHubConflictError("GitHub reference conflict (e.g. branch or commit collision).", status, error_data)
        elif status == 422:
            raise GitHubValidationError(f"GitHub validation failed: {error_data}", status, error_data)
        elif status == 429:
            raise GitHubRateLimitError("GitHub API rate limit exceeded (HTTP 429).", status, error_data)
        else:
            raise GitHubError(msg, status, error_data)

    async def _request(
        self,
        method: str,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        json_data: Optional[Any] = None,
    ) -> Any:
        url = f"{self.base_url}/{path.lstrip('/')}"
        headers = self._get_headers()

        async with httpx.AsyncClient(
            transport=self.transport,
            timeout=self.timeout,
        ) as client:
            try:
                response = await client.request(
                    method=method,
                    url=url,
                    headers=headers,
                    params=params,
                    json=json_data,
                )
                return self._handle_response(response)
            except httpx.TimeoutException as e:
                logger.error(f"GitHub API timeout on {method} {url}")
                raise GitHubNetworkError(f"GitHub API connection timed out: {e}")
            except httpx.RequestError as e:
                logger.error(f"GitHub API network error on {method} {url}: {e}")
                raise GitHubNetworkError(f"Network error connecting to GitHub: {e}")

    async def get_authenticated_user(self) -> Dict[str, Any]:
        """GET /user"""
        return await self._request("GET", "/user")

    async def get_repository(self, owner: str, repo: str) -> Dict[str, Any]:
        """GET /repos/{owner}/{repo}"""
        return await self._request("GET", f"/repos/{owner}/{repo}")

    async def list_branches(self, owner: str, repo: str) -> List[Dict[str, Any]]:
        """GET /repos/{owner}/{repo}/branches"""
        return await self._request("GET", f"/repos/{owner}/{repo}/branches", params={"per_page": 50})

    async def get_branch(self, owner: str, repo: str, branch: str) -> Dict[str, Any]:
        """GET /repos/{owner}/{repo}/branches/{branch}"""
        return await self._request("GET", f"/repos/{owner}/{repo}/branches/{branch}")

    async def get_ref(self, owner: str, repo: str, ref: str) -> Dict[str, Any]:
        """GET /repos/{owner}/{repo}/git/ref/{ref}"""
        clean_ref = ref.replace("refs/", "")
        return await self._request("GET", f"/repos/{owner}/{repo}/git/ref/{clean_ref}")

    async def create_branch(self, owner: str, repo: str, branch_name: str, base_sha: str) -> Dict[str, Any]:
        """POST /repos/{owner}/{repo}/git/refs"""
        payload = {
            "ref": f"refs/heads/{branch_name}",
            "sha": base_sha,
        }
        return await self._request("POST", f"/repos/{owner}/{repo}/git/refs", json_data=payload)

    async def create_blob(self, owner: str, repo: str, content: str, encoding: str = "utf-8") -> Dict[str, Any]:
        """POST /repos/{owner}/{repo}/git/blobs"""
        payload = {
            "content": content,
            "encoding": encoding,
        }
        return await self._request("POST", f"/repos/{owner}/{repo}/git/blobs", json_data=payload)

    async def create_tree(
        self,
        owner: str,
        repo: str,
        base_tree: Optional[str],
        tree_items: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """POST /repos/{owner}/{repo}/git/trees"""
        payload: Dict[str, Any] = {"tree": tree_items}
        if base_tree:
            payload["base_tree"] = base_tree
        return await self._request("POST", f"/repos/{owner}/{repo}/git/trees", json_data=payload)

    async def create_commit(
        self,
        owner: str,
        repo: str,
        message: str,
        tree_sha: str,
        parents: List[str],
    ) -> Dict[str, Any]:
        """POST /repos/{owner}/{repo}/git/commits"""
        payload = {
            "message": message,
            "tree": tree_sha,
            "parents": parents,
        }
        return await self._request("POST", f"/repos/{owner}/{repo}/git/commits", json_data=payload)

    async def update_ref(
        self,
        owner: str,
        repo: str,
        ref: str,
        sha: str,
        force: bool = False,
    ) -> Dict[str, Any]:
        """PATCH /repos/{owner}/{repo}/git/refs/{ref}"""
        clean_ref = ref.replace("refs/", "")
        payload = {
            "sha": sha,
            "force": force,
        }
        return await self._request("PATCH", f"/repos/{owner}/{repo}/git/refs/{clean_ref}", json_data=payload)

    async def list_commits(
        self,
        owner: str,
        repo: str,
        sha: Optional[str] = None,
        per_page: int = 30,
    ) -> List[Dict[str, Any]]:
        """GET /repos/{owner}/{repo}/commits"""
        params: Dict[str, Any] = {"per_page": per_page}
        if sha:
            params["sha"] = sha
        return await self._request("GET", f"/repos/{owner}/{repo}/commits", params=params)

    async def create_pull_request(
        self,
        owner: str,
        repo: str,
        title: str,
        body: str,
        head: str,
        base: str,
        draft: bool = False,
    ) -> Dict[str, Any]:
        """POST /repos/{owner}/{repo}/pulls"""
        payload = {
            "title": title,
            "body": body,
            "head": head,
            "base": base,
            "draft": draft,
        }
        return await self._request("POST", f"/repos/{owner}/{repo}/pulls", json_data=payload)

    async def list_pull_requests(
        self,
        owner: str,
        repo: str,
        state: str = "all",
        per_page: int = 30,
    ) -> List[Dict[str, Any]]:
        """GET /repos/{owner}/{repo}/pulls"""
        params = {"state": state, "per_page": per_page}
        return await self._request("GET", f"/repos/{owner}/{repo}/pulls", params=params)

    async def get_pull_request(self, owner: str, repo: str, pull_number: int) -> Dict[str, Any]:
        """GET /repos/{owner}/{repo}/pulls/{pull_number}"""
        return await self._request("GET", f"/repos/{owner}/{repo}/pulls/{pull_number}")
