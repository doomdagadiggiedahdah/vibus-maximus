# Database Systems

Database systems are software applications that enable the creation, management, and utilization of databases. They provide a systematic way to store, retrieve, and manage data, ensuring data integrity, security, and accessibility.

## Types of Database Systems

### Relational Database Management Systems (RDBMS)

Store data in tables with rows and columns, using SQL for querying and manipulation:

- **MySQL**: Open-source RDBMS
- **PostgreSQL**: Advanced open-source RDBMS
- **Oracle Database**: Enterprise-level RDBMS
- **Microsoft SQL Server**: Microsoft's RDBMS
- **SQLite**: Lightweight, file-based database

### NoSQL Databases

Designed for specific data models with flexible schemas:

- **Document Databases**: MongoDB, CouchDB (JSON-like documents)
- **Key-Value Stores**: Redis, DynamoDB (simple key-value pairs)
- **Wide-Column Stores**: Cassandra, HBase (tables with rows and dynamic columns)
- **Graph Databases**: Neo4j, Amazon Neptune (nodes and edges for related data)

### NewSQL Databases

Combine RDBMS transaction guarantees with NoSQL scalability:

- **Google Spanner**
- **CockroachDB**
- **VoltDB**

## Core Database Concepts

### Data Models

- **Entity-Relationship Model**: Entities, attributes, and relationships
- **Relational Model**: Tables with rows and columns
- **Object-Oriented Model**: Classes and objects
- **Document Model**: Semi-structured documents

### Database Design

- **Normalization**: Reducing data redundancy
- **Indexing**: Speeding up data retrieval
- **Schema Design**: Defining data structure and constraints
- **Data Integrity**: Ensuring accurate and consistent data

### ACID Properties

For transaction processing:

- **Atomicity**: Transactions are all-or-nothing
- **Consistency**: Database remains in a valid state
- **Isolation**: Concurrent transactions don't interfere
- **Durability**: Completed transactions persist

### CAP Theorem

For distributed databases:

- **Consistency**: All nodes see the same data
- **Availability**: Every request receives a response
- **Partition Tolerance**: System functions despite network failures

## Database Technologies

### SQL (Structured Query Language)

Standard language for RDBMS operations:

```sql
SELECT * FROM customers WHERE country = 'USA' ORDER BY last_name;
```

### ORM (Object-Relational Mapping)

Maps between object-oriented code and relational databases:

- **Hibernate** (Java)
- **Entity Framework** (.NET)
- **SQLAlchemy** (Python)
- **Sequelize** (Node.js)

### Database Administration

- **Performance Tuning**: Optimizing queries and database structure
- **Backup and Recovery**: Protecting against data loss
- **Security**: Access control and encryption
- **Scaling**: Vertical (bigger servers) or horizontal (more servers)

## Applications

- **Web Applications**: User data, content, preferences
- **Business Intelligence**: Data warehousing and analytics
- **Enterprise Resource Planning (ERP)**: Business processes
- **Customer Relationship Management (CRM)**: Customer information
- **Internet of Things (IoT)**: Sensor data storage and processing