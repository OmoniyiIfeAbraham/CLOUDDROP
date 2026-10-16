Cloud Drop Backend Documentation

1. Overview

Cloud Drop is a cloud based file storage and sharing application. It allows users to create accounts, log in, upload files, download files, manage their files, and share files with others.

The backend is the part of the application that works behind the scenes. It receives requests from the frontend, checks the information sent by users, communicates with the database, and helps the application perform different tasks.

My work on the project focused mainly on backend development, database setup, authentication, password recovery, account management, and troubleshooting. I also worked with my teammates on some of the configuration needed to run and deploy the application.

Through this project, I learned how the different parts of a cloud application work together to provide services to users.

2. Technology Stack

Technology| What we used it for
Node.js| To run the backend code
Express.js 5| To create API routes and handle requests
TypeScript| To write the backend code with types
PostgreSQL| To store user information and file details
Prisma ORM 7.10.0| To connect the backend to the database
JWT| To help authenticate users
AWS S3| For storing files in the cloud
AWS RDS| For hosting a managed PostgreSQL database
AWS EC2| For running application services on a virtual server
Docker| To package the application into containers
Docker Compose| To run the local development services together
Git and GitHub| To manage code changes and work with teammates
GitHub Actions| To automate building and testing
GitHub Container Registry| To store the backend Docker image
Resend| To support email delivery
Nginx| To help serve the application and direct web requests
React, TypeScript, and Vite| Technologies used to build the frontend

3. Backend Architecture

The backend was built with Node.js, Express, and TypeScript. It works with the frontend, database, and cloud storage to make the application function properly.

The frontend is what users see and interact with. For example, when a user clicks the login button, the frontend sends the login information to the backend.

The backend receives the request and checks the information. If the request is valid, it performs the required operation and sends a response to the frontend. The frontend then uses that response to show the appropriate result to the user.

The backend also communicates with PostgreSQL through Prisma and works with AWS S3 for file storage.

The API uses the "/api/v1" prefix. The authentication routes are grouped under "/api/v1/auth".

In simple terms, the frontend handles the user interface, while the backend handles the application logic, data processing, authentication, and communication with other services.

4. Database Configuration

Cloud Drop uses PostgreSQL to store application information. This includes user records and details about files stored in the application.

We used Prisma ORM to make it easier for the backend to communicate with the database. Instead of writing every database query manually, Prisma provides methods that the backend can use to create, retrieve, update, and delete records.

The main database related files include:

File or directory| Purpose
"backend/prisma7.config.ts"| Contains the Prisma configuration
"backend/prisma/schema.prisma"| Defines the database structure
"backend/src/generated/prisma"| Contains the generated Prisma client
"backend/.env.example"| Shows the environment variables needed by the backend

I also worked with a local PostgreSQL database running through Docker. The database container was named "cloud-drop-db", and port 5432 was exposed so the backend could connect to it from the computer.

Another important part of database management is migrations. A migration records a change to the database structure so that the change can be applied in a controlled way.

For example, while working on password reset session invalidation, a "tokenVersion" field was added to the User model. A migration was created for the change and applied to the local database. I then checked the migration status to confirm that the local database was up to date.

This helped me understand that changing the database structure also requires the correct migration and application code.

5. API Endpoints and Frontend Connection

An API allows two parts of an application to communicate. In Cloud Drop, the frontend sends requests to the backend through API endpoints.

Each endpoint performs a particular task. For example, the registration endpoint creates a user account, while the login endpoint checks the user's credentials.

The main authentication and account endpoints include:

Method| Endpoint| Purpose
POST| "/api/v1/auth/register"| Creates a user account
POST| "/api/v1/auth/login"| Logs a user in
GET| "/api/v1/auth/me"| Retrieves the current authenticated user
POST| "/api/v1/auth/forgot-password"| Starts the password recovery process
POST| "/api/v1/auth/reset-password"| Allows a password reset
POST| "/api/v1/auth/verify-email"| Verifies an email address
POST| "/api/v1/auth/resend-verification"| Requests another verification email
DELETE| "/api/v1/auth/me"| Requests deletion of the current user's account

The project also has file management features for uploading, listing, downloading, deleting, and sharing files. The exact routes for these operations can be found in the corresponding backend route files.

How the frontend connects to the backend

The frontend sends HTTP requests to the backend whenever it needs to perform an operation.

For example, when a user logs in, the frontend sends the login details to the backend. The backend checks the details and returns a response.

For protected requests, the frontend sends an authentication token in the Authorization header. The backend checks the token before allowing access to protected information.

This means the frontend does not need to connect directly to the database. It communicates with the backend, and the backend handles the database operations.

6. Authentication and Password Recovery

Authentication helps the application identify users and control access to protected features.

Registration and login

When a user creates an account, the frontend sends the required information to the backend. The backend processes the request and creates the account if the information passes the necessary checks.

When the user logs in, the backend checks the supplied credentials. If they are correct, the application can continue with an authenticated session.

JWT authentication

Cloud Drop uses JSON Web Tokens, also called JWTs, for authentication.

A token is sent with requests to protected endpoints. The backend checks the token to determine whether the request should be allowed.

For example, a user who wants to access their account information must send the token with the request. The backend then checks it before returning the information.

The backend must also check permissions. A user should not be allowed to access another person's private files simply by changing a file identifier.

Password recovery

Password recovery allows a user who has forgotten their password to request a reset and submit a new password using the recovery process.

The recovery token must be checked to ensure it is valid and has not expired. It should also become unusable after a successful reset.

I worked on the backend password recovery and session invalidation tasks. One important issue was making sure that resetting a password would prevent older login sessions from remaining valid.

To support this, I worked on adding a "tokenVersion" field to the User model and creating the related database migration. The migration was applied successfully to my local database.

However, the complete feature still needs to pass the relevant tests and be verified in the deployed application before it can be considered fully confirmed.

7. Account Management and File Storage

One of the main purposes of Cloud Drop is to allow users to store and manage their files.

The application uses PostgreSQL and AWS S3 for different parts of this process.

PostgreSQL stores information about the files, while AWS S3 is intended to store the actual file contents. Keeping file information in the database makes it easier for the application to identify files and associate them with the correct users.

The backend supports different file operations.

Operation| What it means
Upload| Sends a file to the application for storage
List| Shows the files a user is allowed to access
Retrieve| Gets information about a stored file
Download| Allows a user to obtain a stored file
Delete| Removes a file according to the application rules
Share| Allows a file to be shared where the feature permits it

The backend must check that the user owns a file or has permission to access it before allowing certain operations.

Account deletion

The account deletion endpoint is "DELETE /api/v1/auth/me".

The frontend integration includes a confirmation step before deletion. The user must type "DELETE" to enable the confirmation button. After a successful response, the frontend clears the authentication token and cached data and signs the user out.

If the request fails, the frontend keeps the user signed in and reports the error.

The backend must also handle related database records and stored files according to the application's deletion rules. The frontend confirmation process alone does not confirm that every related record and file has been removed successfully.

8. Email Verification

Cloud Drop uses Resend to support email delivery for account related messages.

For email delivery to work, the backend needs the correct API key and a verified sending domain. These details must be configured through environment variables and must not be exposed in the source code.

The email verification process generally involves sending a verification message to the user, receiving the verification request, checking the token, and updating the account verification status when the token is valid.

The backend should also handle invalid or expired tokens and prevent users from making unlimited verification attempts.

While working on this part of the project, I learned that setting up email delivery requires more than adding an endpoint. The email service, API credentials, domain verification, and backend configuration must all work together.

Actual email delivery and the complete verification process still need to be tested in the target environment.

9. Docker and CI/CD

Docker and CI/CD are important because they help the team prepare and deploy the application more consistently.

Docker and Docker Compose

Docker allows an application and its required components to run in containers.

Docker Compose makes it possible to define services that need to run together. In our local development environment, it was used to run PostgreSQL so the backend could connect to the database.

This made it easier to work with the database without having to set up every service separately.

Git and GitHub

Git and GitHub help the team manage code changes and collaborate.

We used branches to work on different tasks without making every change directly to the main branch. Pull requests were used to review changes before they were merged.

I also worked on resolving conflicts between branches. This required comparing the different versions of files and checking that the changes did not break the existing configuration.

GitHub Actions

GitHub Actions is used to automate build and testing workflows. These checks help the team identify some problems before changes are deployed.

The backend image is published to GitHub Container Registry using the following image reference:

"ghcr.io/omoniyiifeabraham/clouddrop-backend:latest"

After deployment, the application needs to be tested to confirm that its important endpoints are working. A successful health check alone does not guarantee that all routes are available.

10. Troubleshooting and Challenges

During development, I encountered problems involving Prisma, database migrations, API routes, password reset security, and Git conflicts. Working through these issues helped me understand how the different parts of the application depend on one another.

Prisma Client module not found

Problem:

A Node.js command failed because it could not find the generated Prisma client at the path used in the command.

How I approached it:

I checked the Prisma configuration and the location where the client was generated. The import path needed to match the actual generated client location.

What I learned:

When a module cannot be found, it is important to check the project configuration and file location instead of assuming the package is missing.

Pending database migration

Problem:

Prisma reported that the migration for the "tokenVersion" field had not been applied to the local database.

How I approached it:

I applied the migration to the local database and checked the migration status again. The database then reported that the schema was up to date.

What I learned:

A change to the database schema must be applied to the correct database. Checking the migration status helps confirm whether the change has been applied locally, although production must be checked separately.

Authentication endpoint returning 404

Problem:

During deployment troubleshooting, the health endpoint returned HTTP 200, but the "/api/v1/auth/me" endpoint returned HTTP 404.

How I approached it:

I compared the backend versions on the branches being investigated. The version on "feature/backend-setup" mounted the authentication routes, while the inspected version on "feature/devops-cicd" did not have the same route mounting.

What I learned:

A health endpoint can work even when an important application route is missing. It is necessary to test the actual endpoints after deployment.

Password reset and existing sessions

Problem:

An important security concern was that a password reset should prevent previously issued tokens from continuing to work when the application is designed to invalidate those sessions.

How I approached it:

I worked on adding the "tokenVersion" field to the User model and creating the corresponding migration.

What I learned:

A database change alone is not enough to complete a security feature. The token creation and verification logic must also support the change, and the complete process must be tested.

Pull request conflict resolution

Pull request: #10

Branch: "feature/backend-setup"

The pull request initially involved conflicts or changes that needed to be compared in several files.

File| What I did
"backend/.env.example"| Resolved the conflict while keeping the required environment configuration
"backend/Dockerfile"| Compared the changes and checked the file
"backend/package-lock.json"| Compared the dependency lockfile and checked the file
"docker-compose.yml"| Resolved the conflict and checked the local service configuration

I synchronized the branch with changes from "main" and preserved the local ".env" file because it contained untracked configuration.

The recorded result after this work was seven passing tests and a successful build. The branch was updated and pushed, and the pull request was reported to have no remaining conflicts before the reviewer merged it.

This experience taught me to compare changes carefully, protect environment secrets, test after resolving conflicts, and communicate with teammates when changes affect shared configuration.

11. Development and Testing

Testing is important because code that builds successfully may still have problems when it runs or connects to other parts of the application.

For Cloud Drop, important areas to test include registration, login, password recovery, email verification, account deletion, file operations, and access permissions.

The database also needs to be checked to ensure that migrations are applied correctly and that application operations produce the expected results.

During the pull request conflict resolution work, the recorded result was seven passing tests and a successful build. Other password recovery work had additional test failures that needed investigation.

These results must be considered separately because they may come from different branches or test runs. A successful test run does not automatically prove that every feature works in production.

I learned that backend testing should include checking the API response, database changes, authentication rules, and the way the frontend uses the response.

12. Conclusion

Working on Cloud Drop has helped me understand how a backend supports a real application.

I gained practical experience with API routes, PostgreSQL, Prisma, authentication, password recovery, account management, Docker, GitHub, and deployment troubleshooting.

I also learned that backend development involves more than writing code. It requires understanding how the frontend, database, cloud storage, environment variables, and deployment configuration work together.

Some features also require further testing before they can be considered fully verified. This has helped me understand the importance of testing changes carefully and checking that they work in the environment where the application will be used.

Overall, the project has given me practical experience in backend development and helped me improve my debugging, database management, and teamwork skills.
