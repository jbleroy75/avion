FROM python:3.12-alpine
WORKDIR /app
COPY vigie-server.py vigie-lfmn.html ./
RUN adduser -D -H vigie
USER vigie
EXPOSE 8765
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8765/healthz || exit 1
CMD ["python3", "-u", "vigie-server.py", "--host", "0.0.0.0", "--port", "8765", "--no-browser"]
