const express = require('express');
const { v4: uuidv4 } = require('uuid');
const app = express();
app.use(express.json());
const PRIORITY = {
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1
};
const store = {
    ingestions: {},
    batches: {},
    queue: [],
    isProcessing: false,
    lastProcessedTime: 0
};
function getOverallStatus(batches) {
    const statuses = batches.map(b => b.status);
    
    if (statuses.every(s => s === 'completed')) return 'completed';
    if (statuses.some(s => s === 'triggered')) return 'triggered';
    if (statuses.some(s => s === 'yet_to_start')) return 'yet_to_start';
    return 'yet_to_start';
}
async function processBatch(batch) {
    console.log(`Processing batch ${batch.batchId} with IDs: ${batch.ids.join(', ')}`);
    for (const id of batch.ids) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log(`Processed ID ${id}`);
    }
    batch.status = 'completed';
    store.batches[batch.batchId].status = 'completed';
}
async function processQueue() {
    if (store.isProcessing || store.queue.length === 0) return;
    store.isProcessing = true;
    store.queue.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return a.createdAt - b.createdAt;
    });
    const batch = store.queue[0];
    const now = Date.now();
    const timeSinceLast = now - store.lastProcessedTime;
    const delay = Math.max(0, 5000 - timeSinceLast);
    
    if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    store.queue.shift();
    store.lastProcessedTime = Date.now();
    
    // Update batch status
    batch.status = 'triggered';
    store.batches[batch.batchId].status = 'triggered';
    
    await processBatch(batch);
    
    store.isProcessing = false;
    processQueue();
}

// Ingestion API
app.post('/ingest', (req, res) => {
    try {
        const { ids, priority = 'MEDIUM' } = req.body;
        
        // Validate input
        if (!Array.isArray(ids) || ids.some(id => typeof id !== 'number' || id < 1 || id > 1e9 + 7)) {
            return res.status(400).json({ error: 'Invalid IDs' });
        }
        
        if (!['HIGH', 'MEDIUM', 'LOW'].includes(priority)) {
            return res.status(400).json({ error: 'Invalid priority' });
        }
        
        const ingestionId = uuidv4();
        const batches = [];
        const priorityValue = PRIORITY[priority];

        for (let i = 0; i < ids.length; i += 3) {
            const batchIds = ids.slice(i, i + 3);
            const batchId = uuidv4();
            
            const batch = {
                batchId,
                ids: batchIds,
                priority: priorityValue,
                status: 'yet_to_start',
                createdAt: Date.now()
            };
            
            batches.push({ batchId, ids: batchIds, status: 'yet_to_start' });
            store.batches[batchId] = { ...batch };
            store.queue.push(batch);
        }
        
        store.ingestions[ingestionId] = {
            ingestionId,
            batches: batches.map(b => b.batchId),
            status: 'yet_to_start'
        };
        
        processQueue();
        res.json({ ingestion_id: ingestionId });
    } catch (err) {
        res.status(400).json({ error: 'Invalid request' });
    }
});

// Status API
app.get('/status/:ingestionId', (req, res) => {
    const { ingestionId } = req.params;
    const ingestion = store.ingestions[ingestionId];
    
    if (!ingestion) {
        return res.status(404).json({ error: 'Ingestion not found' });
    }
    
    const batches = ingestion.batches.map(batchId => {
        const batch = store.batches[batchId];
        return {
            batch_id: batch.batchId,
            ids: batch.ids,
            status: batch.status
        };
    });
    
    res.json({
        ingestion_id: ingestionId,
        status: getOverallStatus(batches),
        batches
    });
});
app.get('/base' , (req , res) => {
    res.json("Base route")
})

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});