Show recent logs for $ARGUMENTS service.

Valid targets: `backend`, `neo4j`

- **backend**: Check if the backend dev server is running, show recent output
- **neo4j**: Run `docker logs --tail 50 neo4j 2>&1` or check Neo4j container logs

If no argument given, show backend logs by default.
