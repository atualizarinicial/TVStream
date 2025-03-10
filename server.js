// Servidor de proxy simples para desenvolvimento
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import bodyParser from 'body-parser';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Rota de proxy
app.post('/api/proxy', async (req, res) => {
  const { targetUrl, method = 'GET', headers = {}, data } = req.body;
  
  console.log(`Proxy request: ${method} ${targetUrl}`);
  
  try {
    const response = await axios({
      url: targetUrl,
      method,
      headers: {
        ...headers,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      data,
      timeout: 10000,
      validateStatus: () => true // Aceita qualquer status HTTP
    });
    
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(500).json({
      error: 'Proxy error',
      message: error.message
    });
  }
});

// Rota de proxy para GET (compatibilidade)
app.get('/api/proxy', async (req, res) => {
  const targetUrl = req.query.url;
  
  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing target URL' });
  }
  
  console.log(`Proxy GET request: ${targetUrl}`);
  
  try {
    const response = await axios({
      url: targetUrl,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000,
      validateStatus: () => true
    });
    
    // Define os mesmos headers da resposta original
    Object.entries(response.headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    
    res.status(response.status).send(response.data);
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(500).json({
      error: 'Proxy error',
      message: error.message
    });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
}); 