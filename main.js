const axios = require('axios')
const fs = require('fs')
const path = require('path')
const readline = require('readline')
const { GoogleSpreadsheet } = require('google-spreadsheet')
const { JWT } = require('google-auth-library')
require('dotenv').config()

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
})

/**
 * main
 * The main function that orchestrates the entire process of fetching, processing, and exporting business data.
 * @returns {Promise<void>}
 */

async function main() {
	if (!process.env.GOOGLE_API_KEY) {
		console.error('GOOGLE_API_KEY is not set in the environment variables.')
		process.exit(1)
	}

	try {
		const city = await promptUser('Enter city name: ')
		const businessType = await promptUser('Enter business type: ')

		let allBusinesses = new Map()
		let pageToken = null
		let totalFetched = 0

		console.log('Fetching business data...')

		do {
			const data = await getBusinessData(city, businessType, pageToken)

			data.places.forEach(place => {
				if (!allBusinesses.has(place.id)) {
					allBusinesses.set(place.id, place)
					totalFetched++
				}
			})

			pageToken = data.nextPageToken
			console.log(`Fetched ${totalFetched} unique businesses so far...`)

			if (!pageToken || totalFetched >= 60) {
				console.log(
					'Reached maximum number of businesses or no more data to fetch.'
				)
				break
			}
		} while (true)

		console.log('Processing business details...')
		const cleanedData = await Promise.all(
			Array.from(allBusinesses.values()).map(cleanBusinessData)
		)

		console.log('Scoring businesses...')
		const scoredData = cleanedData.map(scoreBusiness)

		// Sort businesses by score in descending order
		scoredData.sort((a, b) => b.score - a.score)

		// Cache the processed data
		const cacheFile = `./cache/${city}_${businessType}_cleaned.json`
		fs.writeFileSync(cacheFile, JSON.stringify(scoredData, null, 2))

		console.log('Exporting data to Google Sheets...')
		await exportToGoogleSheets(scoredData, city, businessType)

		console.log('Process completed successfully!')
	} catch (error) {
		console.error('An error occurred:', error.message)
		if (error.response) {
			console.error('Response status:', error.response.status)
			console.error('Response data:', error.response.data)
		}
	} finally {
		rl.close()
	}
}
/**
 * Prompts the user for input using the readline interface.
 * @param {string} question - The question to ask the user
 * @returns {Promise<string>} - The user's response
 */

async function promptUser(question) {
	return new Promise(resolve => {
		rl.question(question, answer => {
			resolve(answer)
		})
	})
}

/**
 * getBusinessData
 * Fetches business data using the Text Search (New) endpoint of the Places API.
 * @param {string} city - The city to search in
 * @param {string} businessType - The type of business to search for
 * @param {string|null} pageToken - The page token for pagination (optional)
 * @returns {Promise<Object>} - The API response data or cached data
 */

async function getBusinessData(city, businessType, pageToken = null) {
	const cacheFile = `./cache/${city}_${businessType}_raw.json`
	let cachedData = { places: [] }

	if (fs.existsSync(cacheFile)) {
		console.log('Merging with cached data')
		cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'))
	}

	const baseUrl = 'https://places.googleapis.com/v1/places:searchText'
	const textQuery = `${businessType} in ${city}`

	const requestBody = {
		textQuery: textQuery,
		languageCode: 'en'
	}

	if (pageToken) {
		requestBody.pageToken = pageToken
	}

	try {
		const response = await axios.post(baseUrl, requestBody, {
			headers: {
				'Content-Type': 'application/json',
				'X-Goog-Api-Key': process.env.GOOGLE_API_KEY,
				'X-Goog-FieldMask':
					'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,nextPageToken'
			}
		})

		const newData = response.data
		const mergedData = mergeBusinessData(cachedData, newData)

		// Cache the merged data
		fs.writeFileSync(cacheFile, JSON.stringify(mergedData))

		return mergedData
	} catch (error) {
		console.error(
			'Error fetching data from Google Places API:',
			error.message
		)
		if (error.response) {
			console.error('Response status:', error.response.status)
			console.error('Response data:', error.response.data)
		}
		throw error
	}
}

/**
 * getPlaceDetails
 * Fetches detailed information about a specific place using Place Details (New) endpoint.
 * @param {string} placeId - The Google Place ID of the business
 * @returns {Promise<Object|null>} - Detailed place information or null if an error occurs
 */
async function getPlaceDetails(placeId) {
	if (!/^[a-zA-Z0-9_-]+$/.test(placeId)) {
		console.error('Invalid placeId:', placeId)
		return null
	}

	const baseUrl = `https://places.googleapis.com/v1/places/${placeId}`

	try {
		const response = await axios.get(baseUrl, {
			headers: {
				'X-Goog-Api-Key': process.env.GOOGLE_API_KEY,
				'X-Goog-FieldMask':
					'id,displayName,formattedAddress,internationalPhoneNumber,websiteUri,rating,userRatingCount'
			}
		})
		return response.data
	} catch (error) {
		console.error(`Error fetching details for place ${placeId}:`, error)
		return null
	}
}

/**
 * cleanBusinessData
 * Processes and cleans the raw business data, combining information from search results and place details.
 * @param {Object} business - The raw business data from the search results
 * @returns {Promise<Object>} - Cleaned and processed business data
 */
async function cleanBusinessData(business) {
	const cacheDir = path.join(__dirname, 'cache', 'place_details')
	if (!fs.existsSync(cacheDir)) {
		fs.mkdirSync(cacheDir, { recursive: true })
	}

	const cacheFile = path.join(cacheDir, `${business.id}.json`)

	let placeDetails
	if (fs.existsSync(cacheFile)) {
		placeDetails = JSON.parse(fs.readFileSync(cacheFile, 'utf8'))
	} else {
		placeDetails = await getPlaceDetails(business.id)
		fs.writeFileSync(cacheFile, JSON.stringify(placeDetails, null, 2))
	}

	return {
		name:
			placeDetails?.displayName?.text ||
			business.displayName?.text ||
			'N/A',
		address:
			placeDetails?.formattedAddress ||
			business.formattedAddress ||
			'N/A',
		phone: placeDetails?.internationalPhoneNumber || 'N/A',
		website: placeDetails?.websiteUri || 'N/A',
		rating: placeDetails?.rating || business.rating || 'N/A',
		userRatingsTotal:
			placeDetails?.userRatingCount || business.userRatingCount || 'N/A',
		placeId: business.id
	}
}

/**
 * scoreBusiness
 * Calculates a score for a business based on various factors such as having a website, phone number, and ratings.
 * @param {Object} business - The cleaned business data
 * @returns {Object} - The business data with an added score property
 */
function scoreBusiness(business) {
	let score = 0

	// Add points for having a website
	if (business.website && business.website !== 'N/A') score += 2

	// Add points for having a phone number
	if (business.phone && business.phone !== 'N/A') score += 1

	// Add points based on rating
	if (business.rating && business.rating !== 'N/A') {
		score += parseFloat(business.rating)
	}

	// Add points based on number of ratings
	if (business.userRatingsTotal && business.userRatingsTotal !== 'N/A') {
		const ratingCount = parseInt(business.userRatingsTotal)
		if (ratingCount > 100) score += 2
		else if (ratingCount > 50) score += 1
	}

	return { ...business, score }
}
/**
 * exportToGoogleSheets
 * Exports the processed and scored business data to Google Sheets.
 * @param {Array<Object>} data - The array of processed and scored business data
 * @param {string} city - The city searched for
 * @param {string} businessType - The type of business searched for
 * @returns {Promise<void>}
 */
async function exportToGoogleSheets(data, city, businessType) {
	console.log('exportToGoogleSheets function called')
	console.log(`Exporting data for ${businessType} businesses in ${city}`)
	console.log(`Number of records to export: ${data.length}`)

	const SCOPES = [
		'https://www.googleapis.com/auth/spreadsheets',
		'https://www.googleapis.com/auth/drive.file'
	]

	try {
		console.log('Authenticating with Google Sheets...')
		const jwt = new JWT({
			email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
			key: process.env.GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, '\n'),
			scopes: SCOPES
		})

		const doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID, jwt)
		await doc.loadInfo()
		console.log('Spreadsheet loaded')

		let sheet = doc.sheetsByTitle[`${city} - ${businessType}`]
		if (!sheet) {
			sheet = await doc.addSheet({ title: `${city} - ${businessType}` })
		}

		// Clear existing content
		await sheet.clear()

		// Set headers
		const headers = [
			'Name',
			'Address',
			'Phone',
			'Website',
			'Rating',
			'User Ratings Total',
			'Score'
		]
		await sheet.setHeaderRow(headers)

		// Prepare rows for insertion
		const rows = data.map(business =>
			[
				business.name,
				business.address,
				business.phone.startsWith('+1')
					? business.phone.substring(3).trim()
					: business.phone,
				business.website,
				business.rating,
				business.userRatingsTotal,
				business.score
			].map(String)
		) // Convert all values to strings to avoid formula parsing issues

		// Add rows to sheet
		await sheet.addRows(rows)

		console.log('Data exported successfully to Google Sheets')
	} catch (error) {
		console.error('Error exporting to Google Sheets:', error.message)
		if (error.response) {
			console.error('Response status:', error.response.status)
			console.error('Response data:', error.response.data)
		}
		// Log the full error object for debugging
		console.error('Full error:', JSON.stringify(error, null, 2))
	}
}

/**
 * mergeBusinessData
 * Exports the processed and scored business data to Google Sheets.
 * @param {Array<Object>} data - The array of processed and scored business data
 * @param {string} city - The city searched for
 * @param {string} businessType - The type of business searched for
 * @returns {Promise<void>}
 */
function mergeBusinessData(cachedData, newData) {
	const mergedPlaces = new Map()

	// Add cached places to the map
	cachedData.places.forEach(place => {
		mergedPlaces.set(place.id, place)
	})

	// Add or update with new places
	newData.places.forEach(place => {
		mergedPlaces.set(place.id, place)
	})

	return {
		places: Array.from(mergedPlaces.values()),
		nextPageToken: newData.nextPageToken
	}
}
main()
