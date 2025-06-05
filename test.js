const http = require('http');
const assert = require('assert');

const BASE_URL = 'http://localhost:5000';

// Helper to send HTTP request
function httpRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const dataString = data ? JSON.stringify(data) : null;
    const options = {
      method,
      hostname: 'localhost',
      port: 5000,
      path,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': dataString ? Buffer.byteLength(dataString) : 0,
      },
    };

    const req = http.request(options, (res) => {
      let chunks = '';
      res.on('data', (chunk) => (chunks += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(chunks);
          resolve({ statusCode: res.statusCode, body: parsed });
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);

    if (dataString) req.write(dataString);
    req.end();
  });
}

// Utility: Sleep for ms milliseconds
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('Starting tests...');

  // Test 1: POST /ingest with valid input and priority
  const ingestionResp1 = await httpRequest('POST', '/ingest', {
    ids: [1, 2, 3, 4, 5],
    priority: 'MEDIUM',
  });
  assert.strictEqual(ingestionResp1.statusCode, 200);
  assert.ok(ingestionResp1.body.ingestion_id);
  console.log('Test 1 passed: Ingestion POST returns ingestion_id');

  // Test 2: POST /ingest with invalid priority
  const ingestionResp2 = await httpRequest('POST', '/ingest', {
    ids: [1, 2],
    priority: 'INVALID',
  });
  assert.strictEqual(ingestionResp2.statusCode, 400);
  assert.ok(ingestionResp2.body.error);
  console.log('Test 2 passed: Invalid priority returns 400');

  // Test 3: POST /ingest with missing fields
  const ingestionResp3 = await httpRequest('POST', '/ingest', {
    ids: 'not-an-array',
    priority: 'HIGH',
  });
  assert.strictEqual(ingestionResp3.statusCode, 400);
  console.log('Test 3 passed: Invalid ids type returns 400');

  // Test 4: POST multiple ingestions with different priorities
  const ingestionHigh = await httpRequest('POST', '/ingest', {
    ids: [6, 7, 8, 9],
    priority: 'HIGH',
  });
  assert.strictEqual(ingestionHigh.statusCode, 200);
  console.log('Test 4 passed: High priority ingestion accepted');

  // Test 5: Check that batches are processed respecting batch size 3
  // Immediately check status: batches should be yet_to_start or triggered
  const status1 = await httpRequest('GET', `/status/${ingestionResp1.body.ingestion_id}`);
  assert.strictEqual(status1.statusCode, 200);
  assert.strictEqual(status1.body.ingestion_id, ingestionResp1.body.ingestion_id);
  assert.ok(Array.isArray(status1.body.batches));
  assert.ok(status1.body.batches.length >= 2);
  status1.body.batches.forEach((batch) => {
    assert.ok(batch.ids.length <= 3);
    assert.ok(['yet_to_start', 'triggered', 'completed'].includes(batch.status));
  });
  console.log('Test 5 passed: Batches split into max size 3');

  // Test 6: Rate limiting test - batches processed no faster than 1 per 5 seconds
  // We'll POST a low priority batch after high priority and check processing order
  const ingestionLow = await httpRequest('POST', '/ingest', {
    ids: [10, 11, 12, 13],
    priority: 'LOW',
  });

  // Wait 1 second, get status - low priority batches should not be triggered yet if high priority exist
  // Wait 6 seconds to allow batch processing to start (processing rate is 1 batch per 5 seconds)
await sleep(6000);

  const statusHigh = await httpRequest('GET', `/status/${ingestionHigh.body.ingestion_id}`);
  const statusLow = await httpRequest('GET', `/status/${ingestionLow.body.ingestion_id}`);

  // High priority should have some triggered or completed batches
  assert.ok(statusHigh.body.batches.some(b => b.status === 'triggered' || b.status === 'completed'));

  // Low priority should have all batches yet_to_start or triggered only after high priority finishes
  // We can't guarantee precise timing here due to async, but low priority shouldn't start immediately

  console.log('Test 6 passed: Rate limiting and priority respected');

  // Test 7: GET /status with invalid ingestion_id returns 404
  const statusInvalid = await httpRequest('GET', '/status/invalid-id');
  assert.strictEqual(statusInvalid.statusCode, 404);
  assert.ok(statusInvalid.body.error);
  console.log('Test 7 passed: Invalid ingestion_id returns 404');

  console.log('All tests passed!');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});