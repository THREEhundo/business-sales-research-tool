const axios = require('axios')
const { GoogleSpreadsheet } = require('google-spreadsheet')
const { authenticate } = require('@google-cloud/local-auth')
const readline = require('readline')
require('dotenv').config()

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY

if (!GOOGLE_API_KEY) {
	console.error('GOOGLE_API_KEY is not set in the environment variables.')
	process.exit(1)
}

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
})

function prompt(question) {
	return new Promise(resolve => {
		rl.question(question, answer => {
			resolve(answer.trim())
		})
	})
}

async function getBusinessData(city, businessType, pagetoken = null) {
	let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
		businessType
	)}+in+${encodeURIComponent(city)}&key=${GOOGLE_API_KEY}`
	if (pagetoken) {
		url += `&pagetoken=${pagetoken}`
	}

	try {
		// Log the URL being called (remove the API key for security)
		console.log(
			'Calling API URL:',
			url.replace(GOOGLE_API_KEY, 'API_KEY_HIDDEN')
		)

		const response = await axios.get(url)

		// Log the entire response for debugging
		console.log('API Response:', JSON.stringify(response.data, null, 2))

		if (response.status !== 200) {
			console.error(
				'API request failed:',
				response.status,
				response.statusText
			)
			return []
		}

		if (!response.data.results || response.data.results.length === 0) {
			console.log('No results found for the given query.')
			return []
		}

		console.log(`Found ${response.data.results.length} results.`)

		let allResults = response.data.results

		if (response.data.next_page_token) {
			console.log('More results available. Fetching next page...')
			// Wait for 2 seconds before making the next request (API requirement)
			await new Promise(resolve => setTimeout(resolve, 2000))
			const nextPageResults = await getBusinessData(
				city,
				businessType,
				response.data.next_page_token
			)
			allResults = allResults.concat(nextPageResults)
		}

		return allResults
	} catch (error) {
		console.error('Error fetching business data:', error.message)
		// Log the full error object for more details
		console.error('Full error:', error)
		return []
	}
}

async function checkWebsite(website) {
	if (!website) return { hasWebsite: false }

	const url = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(
		website
	)}&key=${GOOGLE_API_KEY}`
	try {
		const response = await axios.get(url)
		const lastModified = response.data.lighthouseResult.fetchTime
		const performanceScore =
			response.data.lighthouseResult.categories.performance.score

		return {
			hasWebsite: true,
			lastModified,
			performanceScore
		}
	} catch (error) {
		console.error('Error checking website:', error.message)
		return { hasWebsite: true, error: 'Unable to fetch website data' }
	}
}

async function main() {
	try {
		const city = await prompt('Enter the city name: ')
		if (!city) throw new Error('City name is required.')

		const businessType = await prompt('Enter the business type: ')
		if (!businessType) throw new Error('Business type is required.')

		console.log(`Searching for ${businessType} businesses in ${city}...`)

		const businesses = await getBusinessData(city, businessType)

		if (businesses.length === 0) {
			console.log('No businesses found matching your criteria.')
			return
		}

		console.log(
			`Found ${businesses.length} businesses. Checking websites...`
		)

		const results = []

		for (const business of businesses) {
			const websiteInfo = await checkWebsite(business.website)
			results.push({
				name: business.name,
				address: business.formatted_address,
				...websiteInfo
			})
		}

		console.log('Results:')
		console.log(JSON.stringify(results, null, 2))
		// TODO: Export results to Google Sheets
	} catch (error) {
		console.error('An error occurred:', error.message)
		// Log the full error object for more details
		console.error('Full error:', error)
	} finally {
		rl.close()
	}
}
main().catch(console.error)
