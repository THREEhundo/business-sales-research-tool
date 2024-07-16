# Business Research Tool

This tool helps gather API data to conduct preliminary research on businesses,
including information about their websites, contact details, and recent updates.
It uses the Google Places API to fetch business information and exports the
results to Google Sheets.

## Features

-   Searches for businesses by city and business type
-   Retrieves detailed information including name, address, phone number,
    website, and more
-   Checks website performance using Google PageSpeed Insights
-   Scores businesses based on potential as leads
-   Caches results to reduce API calls
-   Exports data to Google Sheets with formatting and sorting options

## Prerequisites

-   Node.js (v12 or higher)
-   Google Cloud Platform account with Places API and Sheets API enabled
-   Google API Key
-   Google Service Account credentials for Sheets API

## Setup

1. Clone this repository:

    ```
    git clone https://github.com/yourusername/business-research-tool.git
    cd business-research-tool
    ```

2. Install dependencies:

    ```
    npm install
    ```

3. Create a `.env` file in the project root and add your Google API key and
   service account details:

    ```
    GOOGLE_API_KEY=your_google_api_key
    GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-Private-Key-Here\n-----END PRIVATE KEY-----\n"
    GOOGLE_SHEETS_CLIENT_EMAIL=your-service-account-email@your-project.iam.gserviceaccount.com
    SPREADSHEET_ID=your-google-sheets-spreadsheet-id
    ```

4. Create a `cache` directory in the project root:
    ```
    mkdir cache
    ```

## Usage

Run the script:

```
npm start
```

Follow the prompts to enter a city name and business type. The tool will then:

1. Search for businesses matching the criteria
2. Fetch detailed information for each business
3. Check website performance (if available)
4. Score businesses based on potential as leads
5. Cache the results
6. Export the data to Google Sheets

## How It Works

1. **Data Fetching**: The tool uses the Google Places API to search for
   businesses. It fetches up to 60 results, respecting API pagination.

2. **Caching**: Results are cached in JSON files in the `cache` directory. This
   reduces API calls for repeated searches.

3. **Website Checking**: For businesses with websites, it uses the Google
   PageSpeed Insights API to check performance.

4. **Scoring**: Businesses are scored based on various factors (e.g., absence of
   a website, high ratings, etc.) to identify potential leads.

5. **Data Export**: Results are exported to a Google Sheet. The sheet is
   formatted with headers, styling, and sorting capabilities.

## Code Structure and Main Components

The project consists of the following main components:

1. `main.js`: The entry point of the application. It orchestrates the entire
   process.

2. `getBusinessData()`: Fetches business data from the Google Places API and
   manages caching.

3. `checkWebsite()`: Uses the PageSpeed Insights API to check website
   performance.

4. `scoreBusiness()`: Assigns a score to each business based on various
   criteria.

5. `exportToGoogleSheets()`: Exports the processed data to Google Sheets and
   applies formatting.

6. `ensureCacheDirectory()`: Ensures the cache directory exists for storing
   data.

## API Usage and Quotas

This tool primarily uses two Google APIs:

1. **Google Places API**:

    - Used for searching businesses and fetching their details.
    - Has a default quota of 1,000 requests per day.
    - Each search can return up to 60 results (3 pages of 20 results each).

2. **Google PageSpeed Insights API**:
    - Used for checking website performance.
    - Has a default quota of 25,000 requests per day.

It's crucial to monitor your usage to avoid exceeding these limits. Consider
implementing additional rate limiting if you're processing a large number of
businesses.

## Security Considerations

1. **API Key Protection**: Never commit your `.env` file or expose your API keys
   publicly.

2. **Data Privacy**: The tool caches business data locally. Ensure this cached
   data is stored securely and not accessible to unauthorized parties.

3. **Google Sheets Access**: The service account used for Google Sheets should
   have minimal necessary permissions. Only share the target spreadsheet with
   this account.

4. **Input Validation**: While the tool uses `encodeURIComponent()` for user
   inputs, always be cautious about potential injection attacks.

5. **HTTPS**: Ensure all API calls are made over HTTPS to protect data in
   transit.

## Future Improvements

1. **User Interface**: Develop a web-based UI for easier interaction.

2. **Batch Processing**: Implement batch processing for handling larger datasets
   more efficiently.

3. **Advanced Filtering**: Add more advanced filtering options for the search
   results.

4. **Error Handling**: Enhance error handling and provide more detailed error
   messages.

5. **Logging**: Implement a robust logging system for better debugging and
   monitoring.

6. **API Rate Limiting**: Add intelligent rate limiting to prevent exceeding API
   quotas.

7. **Data Analysis**: Incorporate more advanced data analysis features to
   provide insights on the collected data.

## Known Limitations

1. **Result Limit**: The tool is currently limited to fetching a maximum of 60
   results per search query.

2. **API Dependence**: The tool's functionality is heavily dependent on the
   Google Places and PageSpeed Insights APIs. Any changes to these APIs may
   require updates to the tool.

3. **Single-threaded**: The current implementation is single-threaded, which may
   lead to longer processing times for large datasets.

4. **Limited Scoring Criteria**: The business scoring system is based on a fixed
   set of criteria and may not be suitable for all use cases without
   modification.

## Customization

-   Modify the `scoreBusiness` function in `main.js` to adjust the scoring
    algorithm.
-   Edit the `exportToGoogleSheets` function to change the exported data format
    or styling.

## Troubleshooting

-   If you encounter API errors, check your API key and ensure the necessary
    APIs are enabled in your Google Cloud Console.
-   For issues with Google Sheets export, verify your service account
    credentials and ensure the spreadsheet is shared with the service account
    email.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for
details.
