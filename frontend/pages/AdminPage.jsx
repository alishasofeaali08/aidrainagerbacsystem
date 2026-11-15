import React from 'react';

/** Administrative user and access management; only mounted for administrators. */
export default function AdminPage({ Users, users, act, user, reports }) {
  if (user.role !== 'admin') return null;
  return <Users users={users} act={act} user={user} reports={reports} />;
}
