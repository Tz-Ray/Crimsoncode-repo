#!/bin/bash

echo "📡 Starting API Server..."
# Run API in background
(cd api && npm run dev) & 

echo "⏳ Waiting 5 seconds..."
sleep 5

echo "💻 Starting Desktop Frontend..."
# IMPORTANT: No '&' here. This keeps the process in the foreground.
cd desktop && npm start