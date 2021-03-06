﻿using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.VisualStudio.Services.Common;
using Microsoft.VisualStudio.Services.ReleaseManagement.WebApi;
using Microsoft.VisualStudio.Services.ReleaseManagement.WebApi.Clients;
using Microsoft.VisualStudio.Services.ReleaseManagement.WebApi.Contracts;

namespace VstsServerTaskBroker
{
	public class MockReleaseClient : IReleaseHttpClientWrapper
    {
        public List<AgentArtifactDefinition> MockArtifactDefinitions { get; set; }

        public Release MockRelease { get; set; }

        public bool ReturnNullRelease { get; set; }

        public Task<List<AgentArtifactDefinition>> GetAgentArtifactDefinitionsAsync(Guid projectId, int releaseId, CancellationToken cancellationToken)
        {
            if (this.MockArtifactDefinitions != null)
            {
                return Task.FromResult(this.MockArtifactDefinitions );
            }

            throw new NotImplementedException();
        }

        public Task<Release> GetReleaseAsync(Guid projectId, int releaseId, CancellationToken cancellationToken)
        {
            if (this.ReturnNullRelease)
            {
                return Task.FromResult<Release>(null);
            }

            if (this.MockRelease != null)
            {
                return Task.FromResult(this.MockRelease);
            }

            throw new NotImplementedException();
        }
    }

    public class ReleaseHttpClientWrapper : IReleaseHttpClientWrapper
    {
        private readonly ReleaseHttpClient client;

        public ReleaseHttpClientWrapper(Uri baseUrl, VssCredentials credentials)
        {
            this.client = new ReleaseHttpClient(baseUrl, credentials);
        }

        public async Task<List<AgentArtifactDefinition>> GetAgentArtifactDefinitionsAsync(Guid projectId, int releaseId, CancellationToken cancellationToken)
        {
            var releaseDefs = await this.client.GetAgentArtifactDefinitionsAsync(projectId, releaseId, cancellationToken: cancellationToken).ConfigureAwait(false);

            return releaseDefs;
        }

        public async Task<Release> GetReleaseAsync(Guid projectId, int releaseId, CancellationToken cancellationToken)
        {
            return await this.client.GetReleaseAsync(projectId, releaseId, cancellationToken: cancellationToken);
        }

        public static async Task<bool> IsReleaseValid(IReleaseHttpClientWrapper releaseClient, Guid projectId, int releaseId, CancellationToken cancellationToken)
        {
            try
            {
                var release = await releaseClient.GetReleaseAsync(projectId, releaseId, cancellationToken).ConfigureAwait(false);
                if (release != null && release.Status == ReleaseStatus.Active)
                {
                    return true;
                }
            }
            catch (VssServiceException ex)
            {
                if (!ex.Message.Contains("does not exist"))
                {
                    throw;
                }
            }

            return false;
        }
    }
}