const getConfig = require('probot-config')
const { isTriggerableBranch } = require('./lib/triggerable-branch')
const { findReleases, generateReleaseBody } = require('./lib/releases')
const { findCommits, findPullRequests } = require('./lib/commits')
const log = require('./lib/log')

const configName = 'release-drafter.yml'

module.exports = app => {
  app.on('push', async context => {
    const config = await getConfig(context, configName) || {}
    const branch = context.payload.ref.replace(/^refs\/heads\//, '')

    if (!config.template) {
      log({ app, context, message: 'No valid config found' })
      return
    }

    if (!isTriggerableBranch({ branch, app, context, config })) {
      return
    }

    const { draftRelease, lastRelease } = await findReleases({ app, context })
    const commits = await findCommits({ app, context, branch, lastRelease })
    const mergedPullRequests = await findPullRequests({ app, context, commits })
    const body = generateReleaseBody({ config, lastRelease, mergedPullRequests })

    if (!draftRelease) {
      log({ app, context, message: 'Creating new draft release' })
      await context.github.repos.createRelease(context.repo({
        tag_name: '',
        body: body,
        draft: true
      }))
    } else {
      log({ app, context, message: 'Updating existing draft release' })
      await context.github.repos.editRelease(context.repo({
        release_id: draftRelease.id,
        body: body
      }))
    }
  })
}
