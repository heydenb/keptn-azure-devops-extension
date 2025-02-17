function addTaskToContribution(
  contributions,
  taskId,
  taskName,
  taskDescription
) {
  contributions.push({
    id: taskId,
    description: taskDescription,
    type: "ms.vss-distributed-task.task",
    targets: ["ms.vss-distributed-task.tasks"],
    properties: {
      name: taskName,
    },
  });
}

function addPathToFileContributions(
  fileContributions,
  depPath,
  taskPath,
  packagedTaskPath
) {
  if (packagedTaskPath == undefined || packagedTaskPath === "") {
    packagedTaskPath = taskPath;
  }

  taskObj = {
    path: taskPath,
    packagePath: packagedTaskPath,
  };

  fileContributions.push(
    {
      path: depPath,
      packagePath: packagedTaskPath,
    },
    taskObj
  );
}

module.exports = (env) => {
  let [idPostfix, namePostfix, isPublic] =
    env.mode == "development" ? ["-dev", " [DEV]", false] : ["", "", true];

  if (!env.version) {
    throw new Error("No version found in environment, please check your environment definition!")
  }

  let version = env.version;
  let publisher = "RealdolmenDevOps";
  if (env.mode == "development" && env.publisher) {
    publisher = env.publisher;
  }
  

  let manifest = {
    manifestVersion: 1,
    id: `keptn-integration${idPostfix}`,
    version: version,
    name: `Keptn Integration ${namePostfix}`,
    description:
      "Integration of Keptn within your build or release pipeline.",
    publisher: publisher,
    public: isPublic,
    targets: [
      {
        id: "Microsoft.VisualStudio.Services",
      },
    ],
    icons: {
      default: "images/logo.png",
    },
    scopes: ["vso.build_execute", "vso.release_execute"],
    categories: ["Azure Pipelines"],
    content: {
      details: {
        path: "README.md",
      },
    },
    repository: {
      type: "git",
      uri: "https://github.com/keptn-sandbox/keptn-azure-devops-extension",
    },
    contributions: [
      {
        id: "service-endpoint",
        description: "Service Endpoint type for Keptn",
        type: "ms.vss-endpoint.service-endpoint-type",
        targets: ["ms.vss-endpoint.endpoint-types"],
        properties: {
          name: "Keptn",
          displayName: "Keptn",
          url: {
            displayName: "Keptn API Url",
            helpText: "Url pointing to the Keptn REST API.",
          },
          authenticationSchemes: [
            {
              type: "ms.vss-endpoint.endpoint-auth-scheme-token",
            },
          ],
          helpMarkDown:
            '<a href="https://github.com/keptn-sandbox/keptn-azure-devops-extension" target="_blank"><b>Learn More</b></a>',
        },
      },
    ],
    files: [
      {
        path: "images",
        addressable: true,
      },
      {
        path: "screenshots",
        addressable: true,
      },
      {
        path: "FEATURES.md",
        addressable: true,
      },
      {
        path: "CHANGELOG.md",
        addressable: true
      },
    ],
  };

  addTaskToContribution(
    manifest.contributions,
    "add-keptn-resource",
    "AddKeptnResourceTask",
    "Add a resource to Keptn"
  );
  addPathToFileContributions(
    manifest.files,
    "dist",
    "AddKeptnResourceTask/AddKeptnResourceTaskV1"
  );

  addTaskToContribution(
    manifest.contributions,
    "prep-keptn-env",
    "PrepareKeptnEnvTask",
    "Prepare Keptn environment"
  );
  addPathToFileContributions(
    manifest.files,
    "dist",
    "PrepareKeptnEnvTask/PrepareKeptnEnvTaskV3"
  );

  addTaskToContribution(
    manifest.contributions,
    "send-keptn-event",
    "SendKeptnEventTask",
    "Send an event to Keptn"
  );
  addPathToFileContributions(
    manifest.files,
    "dist",
    "SendKeptnEventTask/SendKeptnEventTaskV3"
  );

  addTaskToContribution(
    manifest.contributions,
    "waitfor-keptn-event",
    "WaitForKeptnEventTask",
    "Wait for a Keptn event"
  );
  addPathToFileContributions(
    manifest.files,
    "dist",
    "WaitForKeptnEventTask/WaitForKeptnEventTaskV2"
  );

  return manifest;
};
