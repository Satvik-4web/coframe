import React, { useState, useEffect } from 'react';
import {
  Layers,
  FileText,
  GitPullRequest,
  History,
  FolderOpen,
  Plus,
  RefreshCw,
  Search,
  ExternalLink,
  Tag,
  Clock,
  User,
  Bot,
  Sparkles,
  CheckCircle2,
  Code2,
} from 'lucide-react';
import { SharedResource, HumanIdentity } from '../../types';
import { fetchResources, createResource } from '../../lib/api';

interface SharedCreationShelfProps {
  initialResources?: SharedResource[];
  identity: HumanIdentity;
  onRefreshProject?: () => void;
}

export const SharedCreationShelf: React.FC<SharedCreationShelfProps> = ({
  initialResources = [],
  identity,
  onRefreshProject,
}) => {
  const [resources, setResources] = useState<SharedResource[]>(initialResources);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedResource, setSelectedResource] = useState<SharedResource | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New Resource Form state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState('file');
  const [newContent, setNewContent] = useState('');
  const [creating, setCreating] = useState(false);

  const loadResources = async () => {
    setLoading(true);
    try {
      const data = await fetchResources('demo-ledgerflow', selectedType === 'all' ? undefined : selectedType);
      setResources(data);
    } catch (err) {
      console.error('Failed to load resources:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResources();
  }, [selectedType]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;
    setCreating(true);
    try {
      let parsedData: any = { content: newContent };
      try {
        parsedData = JSON.parse(newContent);
      } catch {
        // use plain text wrapped
        parsedData = { text: newContent };
      }

      await createResource('demo-ledgerflow', {
        resource_type: newType,
        title: newTitle,
        description: newDesc,
        data: parsedData,
        creator_id: identity || 'alex',
        creator_type: 'human',
      });
      setShowCreateModal(false);
      setNewTitle('');
      setNewDesc('');
      setNewContent('');
      await loadResources();
      if (onRefreshProject) onRefreshProject();
    } catch (err: any) {
      alert(err.message || 'Failed to create resource');
    } finally {
      setCreating(false);
    }
  };

  const filteredResources = resources.filter((res) => {
    const matchesSearch =
      res.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (res.description && res.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      res.resource_type.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'prototype':
        return <Layers className="w-4 h-4 text-teal-600" />;
      case 'requirement':
        return <FileText className="w-4 h-4 text-blue-600" />;
      case 'proposal':
        return <GitPullRequest className="w-4 h-4 text-violet-600" />;
      case 'event':
        return <History className="w-4 h-4 text-amber-600" />;
      default:
        return <FolderOpen className="w-4 h-4 text-emerald-600" />;
    }
  };

  const getCreatorBadge = (creatorType: string, creatorId: string) => {
    if (creatorId === 'alex') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
          <User className="w-3 h-3" /> Alex (Founder)
        </span>
      );
    }
    if (creatorId === 'maya') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
          <User className="w-3 h-3" /> Maya (Designer)
        </span>
      );
    }
    if (creatorId === 'nova') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-100">
          <Bot className="w-3 h-3" /> NOVA (Strategist)
        </span>
      );
    }
    if (creatorId === 'pixel') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700 border border-teal-100">
          <Sparkles className="w-3 h-3" /> PIXEL (Engineer)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-[#CBD5E1] border border-[#1A223D]">
        <Code2 className="w-3 h-3" /> {creatorId}
      </span>
    );
  };

  const typesList = [
    { id: 'all', label: 'All Resources' },
    { id: 'prototype', label: 'Prototype' },
    { id: 'requirement', label: 'Requirements' },
    { id: 'proposal', label: 'Proposals' },
    { id: 'event', label: 'Events' },
    { id: 'file', label: 'Files & Notes' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#1A223D]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">Shared Creation Shelf</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-100">
              OpenAgents Pattern
            </span>
          </div>
          <p className="text-sm text-[#8695B7] mt-1">
            Unified repository of prototype sections, requirement specs, agent proposals, and shared workspace artifacts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadResources}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#8695B7] bg-[#0F1528] border border-[#1A223D] rounded-xl hover:bg-[#090D1A] transition shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-teal-600' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Add Custom Resource
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Type tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
          {typesList.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedType(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                selectedType === t.id
                  ? 'bg-teal-50 text-teal-900 border border-teal-200 font-semibold'
                  : 'text-[#8695B7] hover:bg-[#0F1528] hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-[#8695B7] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search resources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#0F1528] border border-[#1A223D] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-white"
          />
        </div>
      </div>

      {/* Grid of Resources */}
      {filteredResources.length === 0 ? (
        <div className="bg-[#0F1528] border border-[#1A223D] rounded-2xl p-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#141A33] border border-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <FolderOpen className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-white">No resources found</h3>
          <p className="text-xs text-[#8695B7] mt-1 max-w-sm mx-auto">
            {searchQuery
              ? `No resources match "${searchQuery}". Try a different keyword.`
              : 'The workspace resource shelf is currently empty. Add custom notes or start collaborating.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredResources.map((res) => (
            <div
              key={res.id}
              onClick={() => setSelectedResource(res)}
              className="group bg-[#0F1528] border border-[#1A223D] hover:border-teal-300 rounded-xl p-4 transition-all duration-200 shadow-xs hover:shadow-md cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-[#141A33] border border-slate-100 group-hover:bg-teal-50 group-hover:border-teal-100 transition">
                      {getTypeIcon(res.resource_type)}
                    </div>
                    <span className="text-[11px] uppercase tracking-wider font-bold text-[#8695B7]">
                      {res.resource_type}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#141A33] text-[#94A3B8] border border-slate-100">
                    v{res.artifact_version}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-white group-hover:text-teal-700 transition line-clamp-1">
                  {res.title}
                </h3>
                {res.description && (
                  <p className="text-xs text-[#8695B7] mt-1 line-clamp-2">{res.description}</p>
                )}
              </div>

              <div className="pt-3 mt-3 border-t border-[#F0F3F7] flex items-center justify-between text-[11px]">
                {getCreatorBadge(res.creator_type, res.creator_id)}
                <span className="text-[#8695B7] flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(res.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selected Resource Detail Modal */}
      {selectedResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-[#0F1528] rounded-2xl border border-[#1A223D] max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#1A223D] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-teal-50 border border-teal-100">
                  {getTypeIcon(selectedResource.resource_type)}
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">{selectedResource.title}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-[#8695B7] uppercase tracking-wider font-semibold">
                      {selectedResource.resource_type}
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-500">v{selectedResource.artifact_version}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedResource(null)}
                className="text-[#8695B7] hover:text-white p-1.5 rounded-lg hover:bg-[#1A223D] transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {selectedResource.description && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#8695B7] mb-1">
                    Description
                  </h4>
                  <p className="text-xs text-white bg-[#090D1A] p-3 rounded-xl border border-[#1A223D]">
                    {selectedResource.description}
                  </p>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#8695B7]">
                    Resource Payload
                  </h4>
                  <span className="text-[11px] font-mono text-slate-500">JSON Data</span>
                </div>
                <pre className="p-4 bg-slate-900 text-slate-100 text-xs rounded-xl font-mono overflow-x-auto max-h-72 border border-slate-800">
                  {JSON.stringify(selectedResource.data, null, 2)}
                </pre>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                <div className="bg-[#090D1A] p-3 rounded-xl border border-[#1A223D]">
                  <span className="text-[#8695B7] block text-[11px]">Author</span>
                  <div className="mt-1">
                    {getCreatorBadge(selectedResource.creator_type, selectedResource.creator_id)}
                  </div>
                </div>
                <div className="bg-[#090D1A] p-3 rounded-xl border border-[#1A223D]">
                  <span className="text-[#8695B7] block text-[11px]">Created At</span>
                  <p className="font-semibold text-white mt-1">
                    {new Date(selectedResource.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-[#1A223D] bg-[#090D1A] flex justify-end">
              <button
                onClick={() => setSelectedResource(null)}
                className="px-4 py-2 text-xs font-semibold text-[#CBD5E1] hover:bg-slate-200 bg-[#0F1528] border border-[#1A223D] rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Resource Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-[#0F1528] rounded-2xl border border-[#1A223D] max-w-lg w-full flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-[#1A223D] flex items-center justify-between">
              <h2 className="text-base font-bold text-white">Add Shared Resource</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-[#8695B7] hover:text-white p-1.5 rounded-lg hover:bg-[#1A223D] transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Design Tokens Spec or User Research Brief"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#0F1528] border border-[#1A223D] rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white mb-1">
                  Resource Type
                </label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#0F1528] border border-[#1A223D] rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-white"
                >
                  <option value="file">File / Markdown Note</option>
                  <option value="prototype">Prototype Section Spec</option>
                  <option value="requirement">Requirement Spec</option>
                  <option value="version_snapshot">Version Snapshot</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Short context about this resource..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#0F1528] border border-[#1A223D] rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white mb-1">
                  Content (Plain Text or JSON)
                </label>
                <textarea
                  rows={5}
                  required
                  placeholder='{"notes": "Primary call-to-action button should use teal-600 with 8px radius"}'
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#0F1528] border border-[#1A223D] rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-medium text-[#CBD5E1] bg-[#0F1528] border border-[#1A223D] rounded-xl hover:bg-[#141A33] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition shadow-xs flex items-center gap-1.5"
                >
                  {creating && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Save Resource
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
