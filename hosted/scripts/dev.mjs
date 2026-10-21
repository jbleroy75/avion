import http from 'node:http';
import app from '../worker/index.js';
const port=Number(process.env.PORT||4173);
http.createServer(async(req,res)=>{try{const response=await app.fetch(new Request('http://localhost:'+port+req.url,{method:req.method}));res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()))}catch(err){res.writeHead(500);res.end('Preview unavailable')}}).listen(port,'0.0.0.0');
