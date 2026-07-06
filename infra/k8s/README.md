# Kubernetes Deployment Baseline

This directory now contains the first public production-delivery baseline for RAGPilot.

It is intentionally lean:

- `web`, `api`, and `worker` run as Kubernetes deployments
- ingress routes `/` to the web surface and `/api` to the FastAPI service
- runtime configuration lives in `configmap.yaml`
- secret values are documented through `secret.example.yaml`
- stateful dependencies such as PostgreSQL, Redis, MinIO, Elasticsearch, and Temporal are expected to be supplied by managed services or separate cluster operators

## Included manifests

- `namespace.yaml`
- `configmap.yaml`
- `secret.example.yaml`
- `api-deployment.yaml`
- `worker-deployment.yaml`
- `web-deployment.yaml`
- `api-service.yaml`
- `web-service.yaml`
- `ingress.yaml`
- `kustomization.yaml`

## Deployment model

This baseline is meant for a production-shaped control plane, not for local all-in-one development.

The intended topology is:

```text
Ingress
-> Web
-> API
-> Worker
-> PostgreSQL / Redis / MinIO / Elasticsearch / Temporal
```

## Before applying

1. Copy `secret.example.yaml` into your own private secret manifest source.
2. Replace placeholder image names such as `ghcr.io/your-org/ragpilot-api:0.1.0`.
3. Point the config map at your real managed dependency endpoints.
4. Adjust resource requests, ingress class, and hostnames for your cluster.
5. Confirm that `NEXT_PUBLIC_API_BASE_URL` matches the public API route exposed by your ingress.

## Example

```bash
kubectl apply -f infra/k8s/namespace.yaml
kubectl apply -f infra/k8s/configmap.yaml
kubectl apply -f your-private-secret.yaml
kubectl apply -k infra/k8s
```
