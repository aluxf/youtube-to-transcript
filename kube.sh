#!/bin/bash

# Stop execution if any command fails
set -e

# Define the Kubernetes manifest file
KUBE_MANIFEST="kube.yaml"

# Define the template file for the ConfigMap
CONFIG_TEMPLATE="configmap.template.yaml"
CONFIG_OUTPUT="configmap.yaml"

# Apply the Kubernetes resources first (excluding the ConfigMap)
kubectl apply -f "${KUBE_MANIFEST}"

# Now, wait for the services to get assigned an IP, you may need to wait a bit before they are available
echo "Waiting for services to start..."
sleep 10  # You might need to increase this if your services take longer to start

# Get the ClusterIP for textstore and worker services
export TEXTSTORE_IP=$(kubectl get service textstore-service --template='{{.spec.clusterIP}}')
export WORKER_IP=$(kubectl get service worker-service --template='{{.spec.clusterIP}}')
export OPENAI_API_KEY=$(grep OPENAI_API_KEY .env | cut -d '=' -f2)

# Use envsubst to replace the IPs in the ConfigMap template and create an actual ConfigMap file
envsubst < "${CONFIG_TEMPLATE}" > "${CONFIG_OUTPUT}"

# Apply the ConfigMap
kubectl apply -f "${CONFIG_OUTPUT}"
kubectl delete pods -l app=qfapp
kubectl delete pods -l app=worker

# Restart pods if necessary. This could be done by scaling the deployment down to 0 and then up again
# kubectl scale deployment <deployment-name> --replicas=0
# kubectl scale deployment <deployment-name> --replicas=<original-replica-count>

echo "Deployment script finished."
