import axios from 'axios';

export const handler = async (event) => {
  // Habilitar CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // Responder a requisições OPTIONS (preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers
    };
  }

  try {
    let targetUrl, method, requestHeaders, data;

    if (event.httpMethod === 'GET') {
      const params = new URLSearchParams(event.queryStringParameters);
      targetUrl = params.get('url');
      method = 'GET';
      requestHeaders = {};
    } else {
      const body = JSON.parse(event.body);
      targetUrl = body.targetUrl;
      method = body.method || 'GET';
      requestHeaders = body.headers || {};
      data = body.data;
    }

    if (!targetUrl) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing target URL' })
      };
    }

    console.log(`Proxy ${method} request: ${targetUrl}`);

    const response = await axios({
      url: targetUrl,
      method,
      headers: {
        ...requestHeaders,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      data,
      timeout: 10000,
      validateStatus: () => true
    });

    return {
      statusCode: response.status,
      headers: {
        ...headers,
        ...response.headers
      },
      body: typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
    };
  } catch (error) {
    console.error('Proxy error:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Proxy error',
        message: error.message
      })
    };
  }
}; 