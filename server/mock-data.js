const incidents = [
  {
    id: 'INC-1001',
    severity: 'high',
    status: 'investigating',
    title: 'Suspicious PowerShell activity on finance workstation',
    affectedAsset: 'FIN-WS-014',
    detectedAt: '2026-02-09T10:15:00Z',
  },
  {
    id: 'INC-1002',
    severity: 'medium',
    status: 'contained',
    title: 'Repeated failed MFA attempts',
    affectedAsset: 'AzureAD Tenant',
    detectedAt: '2026-02-10T08:30:00Z',
  },
];

const alerts = [
  {
    id: 'ALT-2201',
    level: 'critical',
    source: 'EDR',
    summary: 'Ransomware canary triggered',
    timestamp: '2026-02-10T07:10:00Z',
  },
  {
    id: 'ALT-2202',
    level: 'low',
    source: 'ITDR',
    summary: 'Impossible travel login detected',
    timestamp: '2026-02-10T12:45:00Z',
  },
];

module.exports = { incidents, alerts };
