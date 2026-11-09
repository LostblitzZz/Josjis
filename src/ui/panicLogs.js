/**
 * Realistic Linux kernel, cargo build, webpack, and k8s log stream for Panic Mode
 */
const PANIC_LOG_TEMPLATES = [
  '[cargo::rustc] Compiling tokio-util v0.7.11 (/root/.cargo/registry/tokio-util-0.7.11)',
  '[cargo::rustc] Compiling serde_json v1.0.120',
  '[cargo::rustc] Compiling syn v2.0.68',
  '[cargo::rustc] Compiling axum-core v0.4.3',
  '[cargo::rustc] Compiling tracing-subscriber v0.3.18',
  '[webpack] 74% building 1842/2490 modules (648 active)',
  '[webpack] asset bundle.worker.min.js 1.42 MiB [emitted] (name: main)',
  '[docker:build] Step 18/34 : RUN /bin/sh -c pip install --no-cache-dir -r requirements.txt',
  '[k8s:reconcile] Reconciling pod replica set deployment-api-gateway-7b9f84',
  '[kernel] [  418.912301] pci 0000:00:1f.3: PCI bridge to [bus 02]',
  '[kernel] [  418.912389] e1000e 0000:00:1f.6 eth0: NIC Link is Up 1000 Mbps Full Duplex',
  '[systemd] Started Service Container Runtime Interface (CRI-O).',
  '[systemd-journald] Vacuuming done, deleted 0 files, freed 0 bytes.',
  '[INFO] [worker-pool-4] Connection pool initialized to 10.244.18.92:5432 (pool_size=32)',
  '[DEBUG] [cache-manager] Redis L2 cache hit ratio: 95.8% across 48,192 keys',
  '[INFO] [grpc-gateway] Handled RPC /v2.ClusterTelemetry/ReportMetrics duration=1.8ms status=OK',
  '[DEBUG] [auth-middleware] Token verification successful, tenant="prod-sea-01"',
  '[INFO] [db-migration] Applying 20261102_partition_audit_events.sql ... SUCCESS (18ms)',
  '[metric] Memory stats: rss=184.2MB, heapTotal=94.1MB, heapUsed=68.4MB, external=12.1MB',
  '[cargo::rustc] Finished release [optimized] target(s) in 18.42s',
  '[k8s:ingress] Syncing ingress routing rules with cloud loadbalancer gateway',
  '[DEBUG] [tls-session] Reusing TLS 1.3 session ticket with 192.168.1.104',
  '[INFO] [cron-scheduler] Scheduled task sync_user_quotas dispatched to worker-07'
];

function getRandomLog() {
  const now = new Date();
  const ts = now.toISOString().replace('T', ' ').slice(0, 23);
  const template = PANIC_LOG_TEMPLATES[Math.floor(Math.random() * PANIC_LOG_TEMPLATES.length)];
  return `\x1b[90m${ts}\x1b[0m ${template}`;
}

module.exports = {
  getRandomLog
};
