/**
 * Queue service tests — unit + integration.
 * Run: npx tsx --test tests/queue.test.ts
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JobQueue } from '../src/services/queue-service.js';

describe('Queue — Unit Tests', () => {
  let queue: JobQueue;

  beforeEach(() => {
    queue = new JobQueue({ concurrency: 2, maxRetries: 3, baseBackoffMs: 50, maxBackoffMs: 200 });
  });

  it('submit creates a pending job with unique ID', () => {
    queue.registerHandler('test', async () => 'ok');
    const job = queue.submit('test', { data: 1 });
    assert.ok(job.id);
    assert.equal(job.status, 'pending');
    assert.equal(job.retryCount, 0);
    assert.ok(job.createdAt);
  });

  it('getJob returns submitted job by ID', () => {
    queue.registerHandler('test', async () => 'ok');
    const job = queue.submit('test', {});
    const found = queue.getJob(job.id);
    assert.equal(found?.id, job.id);
  });

  it('getJob returns undefined for unknown ID', () => {
    assert.equal(queue.getJob('nonexistent'), undefined);
  });

  it('submit throws if no handler registered', () => {
    assert.throws(() => queue.submit('unknown', {}), /No handler/);
  });

  it('submit throws if queue is draining', async () => {
    queue.registerHandler('test', async () => 'ok');
    await queue.drain(100);
    assert.throws(() => queue.submit('test', {}), /draining/);
  });

  it('job completes successfully', async () => {
    queue.registerHandler('test', async () => 'result');
    const job = queue.submit('test', {});
    await new Promise(r => setTimeout(r, 50));
    const done = queue.getJob(job.id)!;
    assert.equal(done.status, 'done');
    assert.equal(done.result, 'result');
    assert.ok(done.completedAt);
  });

  it('job retries on failure with backoff', async () => {
    let attempts = 0;
    queue.registerHandler('fail-once', async () => {
      attempts++;
      if (attempts <= 1) throw new Error('transient');
      return 'recovered';
    });
    const job = queue.submit('fail-once', {});
    await new Promise(r => setTimeout(r, 300));
    const result = queue.getJob(job.id)!;
    assert.equal(result.status, 'done');
    assert.equal(result.retryCount, 1);
    assert.equal(attempts, 2);
  });

  it('job fails permanently after maxRetries', async () => {
    queue.registerHandler('always-fail', async () => {
      throw new Error('permanent');
    });
    const job = queue.submit('always-fail', {});
    await new Promise(r => setTimeout(r, 800));
    const result = queue.getJob(job.id)!;
    assert.equal(result.status, 'failed');
    assert.equal(result.retryCount, 3);
    assert.match(result.error!, /permanent/);
  });

  it('FIFO order is maintained', async () => {
    const order: number[] = [];
    queue = new JobQueue({ concurrency: 1, maxRetries: 0, baseBackoffMs: 50, maxBackoffMs: 200 });
    queue.registerHandler('ordered', async (job) => {
      order.push((job.payload as any).n);
    });
    queue.submit('ordered', { n: 1 });
    queue.submit('ordered', { n: 2 });
    queue.submit('ordered', { n: 3 });
    await new Promise(r => setTimeout(r, 200));
    assert.deepEqual(order, [1, 2, 3]);
  });

  it('concurrency limit is respected', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    queue = new JobQueue({ concurrency: 2, maxRetries: 0, baseBackoffMs: 50, maxBackoffMs: 200 });
    queue.registerHandler('concurrent', async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise(r => setTimeout(r, 50));
      concurrent--;
    });
    for (let i = 0; i < 6; i++) queue.submit('concurrent', {});
    await new Promise(r => setTimeout(r, 400));
    assert.ok(maxConcurrent <= 2, `Max concurrent was ${maxConcurrent}, expected ≤ 2`);
  });

  it('getStats returns correct counts', async () => {
    queue.registerHandler('stat-test', async () => 'ok');
    queue.submit('stat-test', {});
    queue.submit('stat-test', {});
    await new Promise(r => setTimeout(r, 100));
    const stats = queue.getStats();
    assert.equal(stats.total, 2);
    assert.equal(stats.done, 2);
    assert.equal(stats.pending, 0);
    assert.equal(stats.active, 0);
  });

  it('drain waits for active jobs', async () => {
    let finished = false;
    queue.registerHandler('slow', async () => {
      await new Promise(r => setTimeout(r, 100));
      finished = true;
    });
    queue.submit('slow', {});
    await new Promise(r => setTimeout(r, 20)); // let it start
    await queue.drain(5000);
    assert.ok(finished, 'Job should have completed during drain');
  });

  it('cleanup removes old completed jobs', async () => {
    queue.registerHandler('test', async () => 'ok');
    queue.submit('test', {});
    await new Promise(r => setTimeout(r, 50));
    assert.equal(queue.getStats().total, 1);
    const removed = queue.cleanup(0); // maxAge=0 means remove all completed
    assert.equal(removed, 1);
    assert.equal(queue.getStats().total, 0);
  });

  it('no job is silently dropped', async () => {
    const processed: string[] = [];
    queue.registerHandler('track', async (job) => {
      processed.push(job.id);
    });
    const jobs = Array.from({ length: 10 }, () => queue.submit('track', {}));
    await new Promise(r => setTimeout(r, 300));
    assert.equal(processed.length, 10, 'All 10 jobs should have been processed');
    for (const j of jobs) {
      assert.ok(processed.includes(j.id), `Job ${j.id} was dropped`);
    }
  });
});

describe('Queue — Integration', () => {
  it('10 simultaneous submissions all complete', async () => {
    const queue = new JobQueue({ concurrency: 3, maxRetries: 2, baseBackoffMs: 50, maxBackoffMs: 200 });
    let counter = 0;
    queue.registerHandler('increment', async () => {
      counter++;
      await new Promise(r => setTimeout(r, 20));
    });

    for (let i = 0; i < 10; i++) queue.submit('increment', { i });
    await new Promise(r => setTimeout(r, 500));

    assert.equal(counter, 10);
    const stats = queue.getStats();
    assert.equal(stats.done, 10);
    assert.equal(stats.failed, 0);
  });

  it('failure→retry→failed lifecycle', async () => {
    const queue = new JobQueue({ concurrency: 1, maxRetries: 2, baseBackoffMs: 30, maxBackoffMs: 100 });
    queue.registerHandler('die', async () => { throw new Error('nope'); });

    const job = queue.submit('die', {});
    await new Promise(r => setTimeout(r, 500));

    const result = queue.getJob(job.id)!;
    assert.equal(result.status, 'failed');
    assert.equal(result.retryCount, 2);
  });
});
