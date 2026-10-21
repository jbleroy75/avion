FROM python:3.12-slim
WORKDIR /app
# Prefer IPv4: the Docker IPv6 (NAT66) path stalls TLS handshakes to api.adsb.lol
RUN echo 'precedence ::ffff:0:0/96 100' >> /etc/gai.conf && useradd -M vigie
COPY vigie-server.py vigie-lfmn.html ./
USER vigie
EXPOSE 8765
HEALTHCHECK --interval=30s --timeout=5s CMD python3 -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8765/healthz',timeout=3)" || exit 1
CMD ["python3", "-u", "vigie-server.py", "--host", "0.0.0.0", "--port", "8765", "--no-browser"]
