import React from 'react';
import { ArrowDownRight, Check, FileText, Layers3, Sparkles } from 'lucide-react';

/** Decorative product workflow graphic; no live status is implied. */
export const WorkflowIllustration: React.FC = () => (
  <div className="cf-workflow-art" aria-hidden="true">
    <div className="cf-workflow-caption">IDEA TO PRODUCT</div>
    <div className="cf-workflow-line" />
    <div className="cf-workflow-node cf-workflow-node-one">
      <span className="cf-workflow-icon cf-workflow-icon-sky"><FileText size={16} strokeWidth={1.8}/></span>
      <span><strong>Shape the brief</strong><small>Define what matters</small></span>
      <span className="cf-workflow-step">01</span>
    </div>
    <div className="cf-workflow-connector"><ArrowDownRight size={17} strokeWidth={1.5}/></div>
    <div className="cf-workflow-node cf-workflow-node-two">
      <span className="cf-workflow-icon cf-workflow-icon-amber"><Check size={16} strokeWidth={1.8}/></span>
      <span><strong>Make the call</strong><small>Human review first</small></span>
      <span className="cf-workflow-step">02</span>
    </div>
    <div className="cf-workflow-connector cf-workflow-connector-last"><ArrowDownRight size={17} strokeWidth={1.5}/></div>
    <div className="cf-workflow-node cf-workflow-node-three">
      <span className="cf-workflow-icon cf-workflow-icon-mint"><Layers3 size={16} strokeWidth={1.8}/></span>
      <span><strong>See it live</strong><small>Prototype together</small></span>
      <span className="cf-workflow-step"><Sparkles size={15}/></span>
    </div>
  </div>
);
