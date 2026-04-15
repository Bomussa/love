#!/bin/bash
echo "{"
echo '  "endpoints": ['
first=true
for file in $(find functions/api/v1 -name "*.js" | sort); do
  endpoint=$(echo "$file" | sed 's|functions/api/v1/||' | sed 's|\.js$||')
  lines=$(wc -l < "$file")
  has_kv=$(grep -c "KV\|env\." "$file" || echo "0")
  has_db=$(grep -c "D1\|database" "$file" || echo "0")
  
  if [ "$first" = false ]; then
    echo ","
  fi
  first=false
  
  echo "    {"
  echo "      \"path\": \"/api/v1/$endpoint\","
  echo "      \"file\": \"$file\","
  echo "      \"lines\": $lines,"
  echo "      \"uses_kv\": $([ "$has_kv" -gt 0 ] && echo "true" || echo "false"),"
  echo "      \"uses_db\": $([ "$has_db" -gt 0 ] && echo "true" || echo "false"),"
  echo "      \"status\": \"needs_migration\""
  echo -n "    }"
done
echo ""
echo "  ]"
echo "}"
