import React from 'react';

/** Camera node streaming and multi-camera analysis workspace. */
export default function CameraAnalysisPage({ AnalysisTab, CameraNode }) {
  return (
    <div className="page-stack">
      <AnalysisTab />
      <CameraNode />
    </div>
  );
}
