# Kubernetes Deployment Baseline

This directory now contains the first public production-delivery baseline for RAGPilot.

It is intentionally lean:

- `web`, `api`, document `worker`, and `agent-worker` run as Kubernetes deployments
- ingress routes `/` to the web surface and `/api` to the FastAPI service
- runtime configuration lives in `configmap.yaml`
- secret values are documented through `secret.example.yaml`
- stateful dependencies such as PostgreSQL, Redis, MinIO, Elasticsearch, and Temporal are expected to be supplied by managed services or separate cluster operators

## Included manifests

- `namespace.yaml`
- `configmap.yaml`
- `secret.example.yaml`
- `migration-job.yaml`
- `api-deployment.yaml`
- `worker-deployment.yaml`
- `agent-worker-deployment.yaml`
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
-> Document Worker / Agent Worker
-> PostgreSQL / Redis / MinIO / Elasticsearch / Temporal
```

## Before applying

1. Copy `secret.example.yaml` into your own private secret manifest source.
2. Replace placeholder image names such as `ghcr.io/your-org/ragpilot-api:0.1.0`.
3. Point the config map at your real managed dependency endpoints.
4. Adjust resource requests, ingress class, and hostnames for your cluster.
5. Confirm that `NEXT_PUBLIC_API_BASE_URL` matches the public API route exposed by your ingress.
6. Install External Secrets Operator and provide a `ClusterSecretStore` named `production-secret-store`; the `ExternalSecret` refreshes `ragpilot/production` hourly.
7. Confirm Metrics Server is available for the API HPA and verify the PodDisruptionBudget before rollout.
8. Provision the `ragpilot-tls` certificate Secret and adjust the ingress-controller namespace selector when the controller does not run in `ingress-nginx`.

## Environment-owned inputs

The checked-in manifests define contracts and safe defaults; they do not choose these values for a real environment:

| Input | Required environment decision |
| --- | --- |
| Immutable images | Replace every `ghcr.io/your-org/...:0.1.0` reference with signed image digests from the release pipeline. Build the API image with `retrieval-llamaindex,agent-langgraph` when either governed framework policy may be activated; API and Agent Worker must use the same capability profile. |
| Stateful services | Supply PostgreSQL/pgvector, Redis, MinIO-compatible object storage, Elasticsearch and Temporal endpoints with tested TLS, authentication, capacity and retention. |
| Embeddings | Select one provider, model and dimension. `EMBEDDING_MODEL` and `RETRIEVAL_EMBEDDING_MODEL` must identify the same embedding space for newly indexed data. |
| Model and MCP runtimes | Provision endpoint URLs and credentials, then activate only capabilities that pass environment health and evaluation gates. |
| Identity | Confirm `password_local` or the deployed provider mode, bootstrap ownership, session policy and recovery procedure. |
| Secrets | Provide `production-secret-store`, the `ragpilot/production` record, rotation ownership and access audit. Do not apply `secret.example.yaml` as real credentials. |
| Network and TLS | Choose public hosts, ingress class, certificate Secret, egress policy and allowed origins. |
| Operations | Set telemetry sampling/retention, alert receivers, on-call ownership, off-cluster backup replication, RPO/RTO and drill cadence. |

Native retrieval remains the authorization and data-lifecycle boundary. LlamaIndex is selected per Retrieval Profile for authorized-context post-processing. LangGraph is selected per eligible Agent Definition inside the Temporal execution boundary. Installing both dependencies makes these policies deployable; it does not force every execution through them.

## Example

```bash
kubectl apply -f infra/k8s/namespace.yaml
kubectl apply -f infra/k8s/configmap.yaml
kubectl apply -f your-private-secret.yaml
kubectl delete job ragpilot-database-migration -n ragpilot --ignore-not-found
kubectl apply -f infra/k8s/migration-job.yaml
kubectl wait --for=condition=complete job/ragpilot-database-migration -n ragpilot --timeout=300s
kubectl apply -k infra/k8s
```

The migration Job must complete against the exact image version being deployed before the API and Worker rollout proceeds.
