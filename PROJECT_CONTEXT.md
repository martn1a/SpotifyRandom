# PROJECT_CONTEXT.md

## Overview

**SpotifyRandom Album Discovery App** is an innovative application designed to enhance music discovery through randomized album suggestions powered by Last.fm data integration. This app allows users to explore a diverse range of albums based on their listening preferences and Last.fm scrobble history. The app seamlessly integrates with Last.fm's database to provide users with personalized recommendations while also connecting with Spotify for audio playback and enhanced user experience.

## Features
- **Last.fm Data Integration:** Primary feature that leverages Last.fm API to analyze user listening history and scrobble data for intelligent album recommendations.
- **Last.fm Authentication:** Users can connect their Last.fm accounts to retrieve their complete listening history and music preferences.
- **Randomized Album Suggestions:** Each time a user initiates a discovery session, a new set of albums is presented based on Last.fm data and pre-configured parameters.
- **Spotify Integration:** Secondary integration with Spotify API for audio playback, track samples, and enhanced metadata.
- **User Personalization:** Algorithms analyze Last.fm scrobble data to adjust recommendations based on the user's actual listening habits and preferences, ensuring fresh and relevant suggestions.
- **User Interface:** An intuitive UI provides an engaging user experience, making it easy for users to navigate album suggestions and listen to previews directly through Spotify.

## Technologies Used
- **Frontend:** React.js for building user interfaces.
- **Backend:** Node.js with Express to handle API requests.
- **Database:** MongoDB for storing user preferences, Last.fm integration data, and interaction histories.
- **Primary API:** Last.fm Web API for fetching user listening history and album/artist data.
- **Secondary API:** Spotify Web API for audio playback and track metadata.

## Installation Instructions
1. Clone the repository: `git clone https://github.com/martn1a/SpotifyRandom`
2. Navigate to the project directory: `cd SpotifyRandom`
3. Install dependencies: `npm install`
4. Set up environment variables for Last.fm API and Spotify API.
5. Start the application: `npm start`

## Usage
Users can sign in using their Last.fm accounts to connect their listening history. The app analyzes their scrobbles and preferences to generate personalized album recommendations. Users can then play previews through Spotify or visit album details. The app continuously refines its suggestions based on user interactions and Last.fm data updates.

## Contribution
Contributions are welcome! Please open issues for suggestions or submit pull requests for improvements.

## License
This project is licensed under the MIT License.