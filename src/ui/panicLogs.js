/**
 * Realistic dev & sys logs for Panic Mode (F3 / Esc)
 */
const PANIC_LOG_TEMPLATES = [
  '[webpack.Progress] 68% building 1420/2091 modules 671 active',
  '[cargo::rustc] Compiling tokio v1.38.0 (/root/.cargo/registry/src/tokio-1.38.0)',
  '[cargo::rustc] Compiling serde_json v1.0.120',
  '[docker:build] Step 18/34 : RUN /bin/sh -c pip install --no-cache-dir -r requirements.txt',
  '[INFO] [worker-pool-4] Connection established to 10.244.18.92:5432 (latency: 1.4ms)',
  '[DEBUG] [cache-manager] Redis cache hit ratio: 94.2% across 14,921 keys',
  '[INFO] [grpc-gateway] Handled rpc /v2.InternalService/PollMetrics status=OK duration=4.2ms',
  '[kernel] [  418.912301] pci 0000:00:1f.3: PCI bridge to [bus 02]',
  '[systemd] Started Service Container Runtime Interface (CRI).',
  '[tsc] Found 0 errors. Watching for file changes...',
  '[vite] hmr update /src/core/pipeline/processor.ts (x2)',
  '[DEBUG] [auth-middleware] Token verification successful, tenant_id="prod-us-east-1"',
  '[INFO] [db-migration] Executing migration: 20261028_optimize_indexes.sql ... OK (42ms)',
  '[audit] Security context constraint validation passed for serviceaccount:default',
  '[metric] Memory usage: rss=142.1MB, heapTotal=88.4MB, heapUsed=61.2MB, external=18.4MB',
  '[cargo::rustc] Finished release [optimized] target(s) in 14.82s',
  '[k8s:ingress] Syncing ingress rules with upstream loadbalancer...',
  '[DEBUG] [tls-session] Reusing TLS 1.3 session ticket with 192.168.1.104',
  '[INFO] [cron-scheduler] Scheduled task sync_user_quotas dispatched to worker-07'
];

function getRandomLog() {
  const ts = new Date().toISOString();
  const template = PANIC_LOG_TEMPLATES[Math.floor(Math.random() * PANIC_LOG_TEMPLATES.length)];
  return `\x1b[90m${ts}\x1b[0m ${template}`;
}

module.exports = {
  getRandomLog
};
