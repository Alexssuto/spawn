# 0005: Kafka as a separate learning lab, not in the production path

**Status:** Proposed

## Context

Kafka is widely used at large organizations (including banks) to move events between systems. Learning it is a goal. Spawn's real ingestion volume is one file of a few thousand rows per day, from one producer, read by one consumer.

## Decision

Do **not** put Kafka in Spawn's production ingestion path. Build a separate lab in `labs/kafka-ingestion/` that runs the **same transform code** behind Kafka:

- A producer reads the source rows and publishes them to `spawn.events.raw`, keyed by `external_id`.
- A consumer group validates and transforms them, writes to PostgreSQL with the same idempotent upsert, and publishes the result to `spawn.events.normalized`.
- Rows that fail validation go to a dead-letter topic, `spawn.events.dlq`, instead of stopping the pipeline.
- Runs locally with Docker Compose (single broker, KRaft mode, no ZooKeeper).

## When Kafka would be justified in Spawn

Several independent sources pushing updates continuously (venues, ticketing, user submissions), several consumers needing the same events (search index, notifications, analytics), or the need to replay history into a new consumer.

## Alternatives considered

- **Kafka in the main pipeline.** Adds a broker to run, monitor and test for no benefit at this volume. An interviewer would rightly ask why.
- **No Kafka at all.** Loses a concrete way to learn partitions, keys, consumer groups, offsets and delivery guarantees on real data.

## Consequences

- Production stays simple: one batch job and one database.
- The lab demonstrates at-least-once delivery made safe by idempotent upserts, ordering per key, consumer-group scaling and dead-letter handling, using real Montréal data.
- The lab is documented as a lab in the README, not presented as production architecture.
