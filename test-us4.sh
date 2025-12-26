#!/bin/bash
# US4 Test Script
TOKEN="eyJhbGciOiJIUzI1NiIsImtpZCI6IkNtNzNVV21xdkpjT2FQZlIiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2FoY3d5bHZzam5zbWJodGRlcXdzLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI0YjA2OTgxMS0zNTYxLTRiYzgtYjNhMy02ZGZlYmE4MWI4ZmEiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzY1ODkyMDU3LCJpYXQiOjE3NjU4ODg0NTcsImVtYWlsIjoidXM0dGVzdEBleGFtcGxlLmNvbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWxfdmVyaWZpZWQiOnRydWUsInBlcm1pc3Npb25zIjpbIioiXSwicm9sZSI6ImFkbWluIiwidGVuYW50X2lkIjoiMjE1YWRjZjUtNTU3Yy00NTQ2LWFjYzEtOTJjOTRiYWMzNzIzIn0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjE3NjU4ODg0NTd9XSwic2Vzc2lvbl9pZCI6IjU2NTQ0ZjViLTZlODQtNGQ4Ny05ZjlkLTZlZTZlMDhjZDdhMSIsImlzX2Fub255bW91cyI6ZmFsc2V9.EpEJ2jVDhHB3ujv5uuHjqhIOWEST8yIqjl2GALDYmO8"
API="http://localhost:3001/api/v1"
AUTH="Authorization: Bearer $TOKEN"

echo "Creating Warehouse A..."
WH_A=$(curl -s -X POST "$API/warehouses" -H "$AUTH" -H "Content-Type: application/json" -d '{"name": "Warehouse A", "address": "Main St", "isActive": true}')
echo $WH_A

echo "Creating Warehouse B..."
WH_B=$(curl -s -X POST "$API/warehouses" -H "$AUTH" -H "Content-Type: application/json" -d '{"name": "Warehouse B", "address": "Branch St", "isActive": true}')
echo $WH_B
