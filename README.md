# Starfleet Communications Module

A Star Trek: The Next Generation-inspired real-time chat application built as a boot-camp project.

Users can register, maintain a crew profile, see other users, search for crew members, view online/offline status, and exchange messages. Chat history is stored in MongoDB and real-time updates use Socket.IO.

## Features

- User registration and login
- Password hashing with bcrypt
- Session-based authentication
- Crew profiles
- Profile-image upload to Azure Blob Storage
- Online/offline presence
- Real-time one-to-one messaging with Socket.IO
- Stored conversation history
- Crew-member search
- EJS-rendered interface
- Jest/Supertest test setup

## Tech stack

- Node.js
- Express
- EJS
- MongoDB / Mongoose
- Socket.IO
- bcrypt
- express-session
- Azure Blob Storage
- Jest
- Supertest

## Screenshots

![Starfleet Communications Module](https://user-images.githubusercontent.com/125992224/232073724-32606a02-e9a9-41e2-8c31-c6e1d938974d.png)

![Starfleet Communications Module](https://user-images.githubusercontent.com/125992224/232074669-2a8755e5-2447-4c9e-8736-7186f24ee9a9.png)

## Local setup

```bash
git clone https://github.com/aminmoji/Starfleet-Communications-Module.git
cd Starfleet-Communications-Module

npm install
cp .env.example .env
npm start
```

## Environment variables

```text
PORT
DATABASE_URL
SESSION_SECRET
AZURE_STORAGE_CONNECTION_STRING
CONTAINER_NAME
```

Do not commit `.env` or Azure/MongoDB credentials.

## Tests

```bash
npm test
```

## Future ideas from the original project

- Group chats based on ship assignment or mission
- Expanded crew search and filtering

## Project status

Historical portfolio / learning project.

The project is kept recognizable as the original implementation. Cleanup focuses on security, documentation, and clear defects rather than rewriting the codebase to resemble a newly generated project.
