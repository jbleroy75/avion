#!/usr/bin/env python3
"""Vigie LFMN — local-only web server and fixed-endpoint data relay. Python 3.9+."""
import argparse,json,pathlib,threading,time,urllib.request,urllib.error,webbrowser
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
ROOT=pathlib.Path(__file__).resolve().parent
WX='https://api.open-meteo.com/v1/forecast?latitude=43.6661&longitude=7.2153&current=temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl&hourly=wind_speed_10m,wind_gusts_10m&wind_speed_unit=kn&forecast_days=2&timezone=GMT'
FEEDS=[('adsb.lol','https://api.adsb.lol/v2/lat/43.6661/lon/7.2153/dist/60'),('airplanes.live','https://api.airplanes.live/v2/point/43.6661/7.2153/60')]
CACHE={};LOCK=threading.Lock()
def retrieve(kind):
 with LOCK:
  cached=CACHE.get(kind)
  if cached and time.time()-cached[0]<(8 if kind=='traffic' else 300):return cached[1]
  errors=[]
  for name,url in FEEDS if kind=='traffic' else [('Open-Meteo',WX)]:
   try:
    if kind=='traffic':url+='?_='+str(int(time.time()//15))
    req=urllib.request.Request(url,headers={'User-Agent':'VigieLFMN/2.0 (personal aviation observatory)','Accept':'application/json'})
    with urllib.request.urlopen(req,timeout=8) as response:data=json.load(response)
    if kind=='traffic':
     if not isinstance(data.get('ac',data.get('aircraft')),list):raise ValueError('Invalid traffic payload')
     if abs(time.time()*1000-float(data.get('now',0)))>60000:raise ValueError('Outdated traffic payload')
    elif not data.get('current'):raise ValueError('Invalid weather payload')
    data['_source']=name;CACHE[kind]=(time.time(),data);return data
   except (OSError,ValueError) as e:errors.append(name+': '+str(e))
  raise ValueError(' / '.join(errors))
class Handler(BaseHTTPRequestHandler):
 def do_GET(self):
  path=self.path.split('?')[0]
  if path in ('/api/traffic','/api/weather'):
   try:payload=json.dumps(retrieve(path.rsplit('/',1)[-1])).encode();code=200
   except ValueError as e:payload=json.dumps({'error':str(e)}).encode();code=503
   self.send_response(code);self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(payload)
  elif path in ('/','/vigie-lfmn.html'):
   data=(ROOT/'vigie-lfmn.html').read_bytes();self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
  else:self.send_error(404)
 def log_message(self,format,*args):pass
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--port',type=int,default=8765);parser.add_argument('--no-browser',action='store_true');args=parser.parse_args()
 try:server=ThreadingHTTPServer(('127.0.0.1',args.port),Handler)
 except OSError as e:raise SystemExit('Impossible de démarrer le serveur : '+str(e))
 url=f'http://127.0.0.1:{args.port}/';print('Vigie LFMN : '+url+'\nLaisser cette fenêtre ouverte. Ctrl+C pour arrêter.',flush=True)
 if not args.no_browser:threading.Timer(.6,lambda:webbrowser.open(url)).start()
 try:server.serve_forever()
 except KeyboardInterrupt:pass
 finally:server.server_close()
