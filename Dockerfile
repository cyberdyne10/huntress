FROM node:20-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip python3-venv git \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN python3 -m venv /opt/venv \
  && /opt/venv/bin/pip install --no-cache-dir --upgrade pip \
  && /opt/venv/bin/pip install --no-cache-dir "world-intel-mcp[dashboard] @ git+https://github.com/marc-shade/world-intel-mcp@master"

ENV PATH="/opt/venv/bin:$PATH"
ENV NODE_ENV=production
ENV PORT=10000
ENV INTEL_DASHBOARD_PORT=9001
ENV INTEL_DASHBOARD_BASEPATH=/intel-dashboard

EXPOSE 10000

CMD ["bash", "./scripts/start.sh"]
