import express from 'express';
import next from 'next';
import http from 'http';
import path from 'path';
import fs from 'fs';
import bodyParser from 'body-parser';
import cors from 'cors';
import countries from './public/countries.json' with { type: "json" };

const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

const port = process.env.PORT || process.env.API_PORT || 3001;

nextApp.prepare().then(() => {
  const app = express();
  const server = http.createServer(app);

  app.use(cors());
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

  // Dynamic route handler for /api files
  const apiFolder = path.join(process.cwd(), 'api');
  if (fs.existsSync(apiFolder)) {
    const loadFolder = (folder, subdir = '') => {
      fs.readdirSync(folder).forEach(file => {
        const filePath = path.join(folder, file);
        if (fs.lstatSync(filePath).isDirectory()) {
          loadFolder(filePath, subdir + file + '/');
          return;
        }
        if (!file.endsWith('.js')) return;

        const routePath = './api/' + subdir + file.split('.')[0] + '.js';
        const webPath = '/api/' + subdir + file.split('.')[0];
        import(routePath).then(module => {
          app.all(webPath, (req, res) => {
            Promise.resolve(module.default(req, res)).catch((err) => {
              if (!res.headersSent) res.status(500).json({ error: 'Server error' });
            });
          });
        }).catch(() => {});
      });
    };
    loadFolder(apiFolder);
  }

  // Country location endpoints
  let countryLocations = {};
  for (const country of countries) {
    countryLocations[country] = [];
  }

  app.get('/countryLocations/:country', (req, res) => {
    res.set('Cache-Control', 'public, max-age=60, s-maxage=60');
    if (!countryLocations[req.params.country]) {
      return res.status(404).json({ message: 'Country not found' });
    }
    return res.json({ ready: true, locations: countryLocations[req.params.country] || [] });
  });

  app.get('/mapLocations/:slug', (req, res) => {
    res.status(404).json({ message: 'Custom maps disabled in DB-free mode' });
  });

  app.post('/mapPlay/:slug', (req, res) => {
    res.send('ok');
  });

  // Serve static assets and pass UI routes to Next.js handler
  app.all('*', (req, res) => {
    return handle(req, res);
  });

  server.listen(port, () => {
    console.log(`[INFO] Server running on port ${port}`);
  });
}).catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
