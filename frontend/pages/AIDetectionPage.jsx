import React from 'react';

/** Registered AI camera monitoring and detection controls. */
export default function AIDetectionPage({ AICameraSystem, cameras, user, act }) {
  return <AICameraSystem cameras={cameras} user={user} act={act} />;
}
