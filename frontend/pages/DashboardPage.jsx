import React from 'react';

/** Unified operations home: overview, role-specific cases, reports and leaderboard. */
export default function DashboardPage({
  Overview, ReportsTab, EngineerCases, TechnicianCases, TechLeaderboard,
  reports, flood, user, act,
}) {
  return (
    <div className="page-stack">
      <Overview reports={reports} flood={flood} user={user} />
      {['citizen', 'technician', 'engineer', 'admin'].includes(user.role) && (
        <ReportsTab user={user} reports={reports} act={act} />
      )}
      {user.role === 'engineer' && (
        <EngineerCases reports={reports} user={user} act={act} />
      )}
      {user.role === 'technician' && (
        <TechnicianCases reports={reports} act={act} user={user} />
      )}
      {['admin', 'engineer', 'technician'].includes(user.role) && (
        <TechLeaderboard user={user} />
      )}
    </div>
  );
}
