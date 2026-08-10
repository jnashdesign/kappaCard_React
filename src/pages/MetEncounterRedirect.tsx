import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { getEncounter } from '../lib/encounters';

/** Legacy /met/:encounterId → /brothers/:subjectUserId when possible. */
export default function MetEncounterRedirect() {
  const { encounterId = '' } = useParams();
  const [target, setTarget] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const row = await getEncounter(encounterId);
        if (active) {
          setTarget(row?.ownerId ? `/brothers/${row.ownerId}` : '/brothers');
        }
      } catch {
        if (active) setTarget('/brothers');
      } finally {
        if (active) setDone(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [encounterId]);

  if (!done || !target) return <div className="panel">Loading…</div>;
  return <Navigate to={target} replace />;
}
