import { createContext, useContext, useMemo } from 'react';
import { DEFAULT_STATUS_RULES, getOccupancyStatus, statusMeta } from '../../domain/occupancy';

export const StatusRulesContext = createContext(DEFAULT_STATUS_RULES);

/**
 * Aturan status yang berlaku (dari Back Office).
 * { rules: { kuning, merah }, meta: tampilan per status, statusOf(room) }
 */
export function useStatusRules() {
  const rules = useContext(StatusRulesContext);
  return useMemo(
    () => ({
      rules,
      meta: statusMeta(rules),
      statusOf: (room) => getOccupancyStatus(room, rules),
    }),
    [rules],
  );
}
