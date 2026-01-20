# IndiChessApplication

IndiChessApplication is a full-stack chess application built with a Spring Boot backend and a React frontend.

## Project Structure

The project currently consists of two main modules:

-   **IndiChessBackend**: The backend server built with Java and Spring Boot.
-   **Indichessfrontend**: The frontend user interface built with React, Vite, and TailwindCSS.

## Technologies Used

### Backend
-   **Java 17**
-   **Spring Boot 3+** (v4.0.1 mentioned in pom)
-   **Spring Security** with JWT (JJWT)
-   **Spring Data JPA**
-   **Database**: MySQL (Runtime) / H2 (Test)
-   **WebSocket** support

### Frontend
-   **React 19**
-   **Vite**
-   **TailwindCSS 4**
-   **React Router DOM**

## Prerequisites

Ensure you have the following installed on your local machine:

-   **Java 17**
-   **Node.js** (LTS version recommended)
-   **npm** (comes with Node.js)

## Getting Started

### Backend Setup

1.  Navigate to the backend directory:
    ```bash
    cd IndiChessBackend
    ```

2.  Run the application using the Maven wrapper:
    ```bash
    ./mvnw spring-boot:run
    ```
    
    The backend server will typically start on port `8080`.

### Frontend Setup

1.  Navigate to the frontend directory:
    ```bash
    cd Indichessfrontend
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Start the development server:
    ```bash
    npm run dev
    ```

    The frontend application will typically start on `http://localhost:5173`.

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.
