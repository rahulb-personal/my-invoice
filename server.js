const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3000;
const QUOTATIONS_DIR = path.join(__dirname, 'quotations');
const MANIFEST_PATH = path.join(QUOTATIONS_DIR, 'manifest.json');

// Ensure quotations directory exists
if (!fs.existsSync(QUOTATIONS_DIR)) {
    fs.mkdirSync(QUOTATIONS_DIR);
}

function updateManifest() {
    try {
        const files = fs.readdirSync(QUOTATIONS_DIR).filter(f => f.endsWith('.json') && f !== 'manifest.json');
        const list = files.map(f => {
            const data = JSON.parse(fs.readFileSync(path.join(QUOTATIONS_DIR, f)));
            return { id: data.id, name: data.name, customerName: data.customerName, savedAt: data.savedAt };
        });
        fs.writeFileSync(MANIFEST_PATH, JSON.stringify(list, null, 2));
    } catch (e) { console.error('Manifest update failed', e); }
}

const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/api/save') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const filename = (data.id || 'untitled').replace(/[^a-z0-9]/gi, '_').toLowerCase();
                const filePath = path.join(QUOTATIONS_DIR, `${filename}.json`);

                fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
                updateManifest();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Saved to disk', path: filePath }));
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
        });
    } else if (req.method === 'POST' && req.url === '/api/export') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const filename = (data.name || 'quotation').replace(/[^a-z0-9]/gi, '_').toLowerCase();
                const filePath = path.join(QUOTATIONS_DIR, `${filename}.html`);

                fs.writeFileSync(filePath, data.html);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'HTML Exported', path: filePath }));
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
        });
    } else if (req.method === 'POST' && req.url === '/api/delete') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const filename = (data.id || '').replace(/[^a-z0-9]/gi, '_').toLowerCase();
                const filePath = path.join(QUOTATIONS_DIR, `${filename}.json`);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                updateManifest();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
        });
    } else if (req.method === 'GET' && req.url === '/api/list') {
        try {
            updateManifest();
            if (fs.existsSync(MANIFEST_PATH)) {
                const data = fs.readFileSync(MANIFEST_PATH);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(data);
            } else {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify([]));
            }
        } catch (err) {
            res.writeHead(500);
            res.end(err.message);
        }
    } else if (req.method === 'POST' && req.url === '/api/sync') {
        exec('git add quotations/ && git commit -m "Sync quotations manifest and files" && git push', (err, stdout, stderr) => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: !err, stdout, stderr }));
        });
    } else if (req.method === 'GET' && req.url === '/api/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'online' }));
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.listen(PORT, () => {
    console.log(`Cloud9 Quotation Server running at http://localhost:${PORT}`);
    console.log(`Quotations will be saved in: ${QUOTATIONS_DIR}`);
});
