const core = require('@actions/core');
const github = require('@actions/github');
const httpClient = require('@actions/http-client');
const { uploadArtifact } = require('@actions/artifact');

async function run() {
  try {
    const url = core.getInput('url', { required: true });
    const appName = core.getInput('appName', { required: true });
    const packageName = core.getInput('packageName') || undefined;
    const outputType = core.getInput('outputType') || 'apk';
    const platform = core.getInput('platform') || 'android';
    const provider = core.getInput('provider') || 'capacitor';
    const signingEnabled = core.getInput('signingEnabled') === 'true';
    const keystoreBase64 = core.getInput('keystoreBase64') || undefined;
    const keystorePassword = core.getInput('keystorePassword') || undefined;
    const keyAlias = core.getInput('keyAlias') || undefined;
    const keyPassword = core.getInput('keyPassword') || undefined;
    const permissions = core.getInput('permissions') || undefined;
    const versionName = core.getInput('versionName') || '1.0.0';
    const versionCode = parseInt(core.getInput('versionCode') || '1', 10);

    const apiKey = process.env.INTEEBUILD_API_KEY;
    const apiUrl = process.env.INTEEBUILD_API_URL || 'https://api.inteebuild.com';

    if (!apiKey) {
      core.setFailed('INTEEBUILD_API_KEY environment variable is required');
      return;
    }

    const config = {
      url,
      appName,
      packageName,
      outputType,
      platform,
      provider,
      signingEnabled,
      keystoreBase64,
      keystorePassword,
      keyAlias,
      keyPassword,
      permissions: permissions ? JSON.parse(permissions) : undefined,
      versionName,
      versionCode
    };

    core.info('Starting InteeBuild build...');
    core.info(`Config: ${JSON.stringify(config, null, 2)}`);

    const client = new httpClient.HttpClient('inteebuild-action');
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey
    };

    const buildResponse = await client.postJson(`${apiUrl}/api/v1/build`, config, headers);
    const buildResult = await buildResponse.readBody();

    if (buildResponse.message.statusCode !== 200 && buildResponse.message.statusCode !== 201) {
      core.setFailed(`Failed to start build: ${buildResult}`);
      return;
    }

    const buildData = JSON.parse(buildResult);
    const buildId = buildData.id;
    core.info(`Build started with ID: ${buildId}`);

    core.setOutput('buildId', buildId);

    let buildStatus = 'pending';
    let buildResultData = null;
    let attempts = 0;
    const maxAttempts = 300;
    const pollInterval = 10000;

    while (buildStatus === 'pending' || buildStatus === 'building') {
      if (attempts >= maxAttempts) {
        core.setFailed('Build timed out after 50 minutes');
        return;
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
      attempts++;

      const statusResponse = await client.getJson(`${apiUrl}/api/v1/build/${buildId}`, headers);
      const statusResult = await statusResponse.readBody();

      if (statusResponse.message.statusCode !== 200) {
        core.setFailed(`Failed to get build status: ${statusResult}`);
        return;
      }

      buildResultData = JSON.parse(statusResult);
      buildStatus = buildResultData.status;
      core.info(`Build status: ${buildStatus} (attempt ${attempts}/${maxAttempts})`);
    }

    if (buildStatus === 'failed') {
      core.setFailed(`Build failed: ${buildResultData.error || 'Unknown error'}`);
      return;
    }

    if (buildStatus !== 'success') {
      core.setFailed(`Build ended with unexpected status: ${buildStatus}`);
      return;
    }

    core.info('Build completed successfully!');

    const artifacts = buildResultData.artifacts || {};
    const runUrl = `${github.context.serverUrl}/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${github.context.runId}`;

    core.setOutput('runUrl', runUrl);

    if (artifacts.apk) {
      core.setOutput('apkUrl', artifacts.apk.url);
      await uploadArtifact('apk', [artifacts.apk.path], '.');
      core.info(`APK uploaded: ${artifacts.apk.url}`);
    }

    if (artifacts.aab) {
      core.setOutput('aabUrl', artifacts.aab.url);
      await uploadArtifact('aab', [artifacts.aab.path], '.');
      core.info(`AAB uploaded: ${artifacts.aab.url}`);
    }

    if (artifacts.ipa) {
      await uploadArtifact('ipa', [artifacts.ipa.path], '.');
      core.info(`IPA uploaded: ${artifacts.ipa.url}`);
    }

    if (artifacts.desktop) {
      for (const [format, artifact] of Object.entries(artifacts.desktop)) {
        await uploadArtifact(format, [artifact.path], '.');
        core.info(`${format.toUpperCase()} uploaded: ${artifact.url}`);
      }
    }

    core.info('All artifacts uploaded successfully');
  } catch (error) {
    core.setFailed(`Action failed: ${error.message}`);
  }
}

run();