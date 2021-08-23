import tl = require('azure-pipelines-task-lib/task');
import axios, { Method, AxiosInstance } from 'axios';
import https = require('https');

class Params {
	waitForEventType: string = '';
	timeout: number = 3;
	keptnContextVar: string = '';
	keptnApiEndpoint: string = '';
	keptnApiToken: string = '';
	keptnBridgeEndpoint: string | undefined;
	markBuildOn: {[index:string]:string} = {
		"fail": 'WARNING',
		"warning": 'WARNING',
		"info": 'NOTHING'
	}
}

const logIssueMap:{[index:string]:tl.IssueType} = {
	"WARNING":tl.IssueType.Warning,
	"FAILED":tl.IssueType.Error
}

const completeTaskMap:{[index:string]:tl.TaskResult} = {
	"WARNING":tl.TaskResult.SucceededWithIssues,
	"FAILED":tl.TaskResult.Failed
}

/**
 * Prepare input parameters
 */
function prepare():Params | undefined {
	
	try {
	    const waitForEventType: string | undefined = tl.getInput('waitForEventType');
		const project: string | undefined = tl.getInput('project');
		const service: string | undefined = tl.getInput('service');
		const stage: string | undefined = tl.getInput('stage');
		
		let keptnApiEndpointConn: string | undefined =  tl.getInput('keptnApiEndpoint');
		
		let p = new Params();
		let badInput:string[]=[];

		if (waitForEventType !== undefined) {
			p.waitForEventType = waitForEventType;
		}
		else{
            badInput.push('waitForEventType');
		}
		
		let timeoutStr: string | undefined = tl.getInput('timeout');
		if (timeoutStr != undefined){
			p.timeout = +timeoutStr;
		}
		else{
			badInput.push('timeout');
		}

		let keptnContextVar: string | undefined = tl.getInput('keptnContextVar');
		if (keptnContextVar != undefined){
			p.keptnContextVar = keptnContextVar;
		}
		else{
			badInput.push('keptnContextVar');
		}

		let markBuildOnFail: string | undefined = tl.getInput('markBuildOnError');
		if (markBuildOnFail != undefined){
			p.markBuildOn.fail = markBuildOnFail;
		}
		let markBuildOnWarning: string | undefined = tl.getInput('markBuildOnWarning');
		if (markBuildOnWarning != undefined){
			p.markBuildOn.warning = markBuildOnWarning;
		}
		

		if (keptnApiEndpointConn !== undefined) {
			const keptnApiEndpoint: string | undefined = tl.getEndpointUrl(keptnApiEndpointConn, false);
			const keptnApiToken: string | undefined = tl.getEndpointAuthorizationParameter(keptnApiEndpointConn, 'apitoken', false);
			const keptnBridgeEndpoint: string | undefined = tl.getInput('bridgeURL');
			
			if (keptnApiEndpoint != undefined){
				p.keptnApiEndpoint = keptnApiEndpoint;
			}
			else{
				badInput.push('keptnApiEndpoint');
			}
			if (keptnApiToken !== undefined) {
				p.keptnApiToken = keptnApiToken;
			}
			else{
				badInput.push('keptnApiToken');
			}
			if (keptnBridgeEndpoint !== undefined) {
				p.keptnBridgeEndpoint = keptnBridgeEndpoint;
			}
		}
		else{
			badInput.push('keptnApiEndpoint');
		}
		if (badInput.length > 0) {
            tl.setResult(tl.TaskResult.Failed, 'missing required input (' + badInput.join(',') + ')');
            return;
        }
        
		console.log('using keptnApiEndpoint', p.keptnApiEndpoint);
		console.log('using waitForEventType', p.waitForEventType);

		return p;
	} catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
}

/**
 * Main logic based on the different event types.
 * 
 * @param input Parameters
 */
async function run(input:Params){
	try{
		const axiosInstance = axios.create({
			httpsAgent: new https.Agent({  
				rejectUnauthorized: false
			})
		});
		if (input.waitForEventType == 'evaluationDone'){
			let keptnVersion = tl.getVariable('keptnVersion');
			if (keptnVersion==null){
				keptnVersion = '0.8.1'; //smart default
			}
			if (keptnVersion.startsWith('0.8')){
				return waitForEvaluationDone(input, axiosInstance);
			} 
			else{
				return waitForEvaluationDonePre08(input, axiosInstance);
			}
		}
		else{
			throw new Error('Unsupported eventType');
		}
	}catch(err){
		throw err;
	}
	return "task finished";
}

/**
 * Request the evaluation-done event based on the startEvaluationKeptnContext task variable.
 * Try a couple of times since it can take a few seconds for keptn to evaluate.
 * 
 * @param input Parameters
 * @param httpClient an instance of axios
 */
async function waitForEvaluationDone(input:Params, httpClient:AxiosInstance){
	let keptnContext = tl.getVariable(input.keptnContextVar);
	console.log('using keptnContext = ' + keptnContext);
	let evaluationScore = -1;
	let evaluationResult = "empty";

	let options:any = {
		method: <Method>"GET",
		headers: {'x-token': input.keptnApiToken},
		url: input.keptnApiEndpoint + '/mongodb-datastore/event?type=sh.keptn.event.evaluation.finished&keptnContext=' + keptnContext
	}
	
	let c=0;
	let max = (input.timeout * 60) / 10
	let out;
	console.log("waiting in steps of 10 seconds, max " + max + " loops.");
	do{
		await delay(10000); //wait 10 seconds
		var response = await httpClient(options);
		if (response.data.events != undefined && response.data.totalCount == 1){
			out = response.data.events[0];
			evaluationScore = out.data.evaluation.score;
			evaluationResult = out.data.evaluation.result;
		}
		else {
			if (++c > max){
				evaluationResult = "not-found"
			}
			else {
				console.log("wait another 10 seconds");
			}
		}
	}while (evaluationResult == "empty");

	handleEvaluationResult(evaluationResult, evaluationScore, keptnContext, input);

	console.log("************* Result from Keptn ****************");
	console.log(JSON.stringify(out, null, 2));

	return evaluationResult;
}

/**
 * Request the evaluation-done event based on the startEvaluationKeptnContext task variable.
 * Try a couple of times since it can take a few seconds for keptn to evaluate.
 * 
 * @param input Parameters
 * @param httpClient an instance of axios
 */
async function waitForEvaluationDonePre08(input:Params, httpClient:AxiosInstance){
	let keptnContext = tl.getVariable(input.keptnContextVar);
	console.log('using keptnContext = ' + keptnContext);
	let evaluationScore = -1;
	let evaluationResult = "empty";
	let evaluationDetails:any;

	let options:any = {
		method: <Method>"GET",
		headers: {'x-token': input.keptnApiToken},
		url: input.keptnApiEndpoint + '/v1/event?type=sh.keptn.events.evaluation-done&keptnContext=' + keptnContext
	};

	let c=0;
	let max = (input.timeout * 60) / 10
	let out;
	console.log("waiting in steps of 10 seconds, max " + max + " loops.");
	do{
		try{
			await delay(10000); //wait 10 seconds
			var response = await httpClient(options);
			evaluationScore = response.data.data.evaluationdetails.score;
			evaluationResult = response.data.data.evaluationdetails.result;
			evaluationDetails = response.data.data.evaluationdetails;
			out = response.data.data;
		}catch(err){
			if (err != undefined 
				&& err.response != undefined 
				&& err.response.data != undefined
				&& err.response.data.code != undefined
				&& err.response.data.message != undefined
				&& (
					err.response.data.code == '500' || 
					err.response.data.code == '404') //From Keptn 0.7 onwards a 404 is thrown in stead of 500
				&& (
					err.response.data.message.startsWith('No Keptn sh.keptn.events.evaluation-done event found for context') || 
					err.response.data.message.startsWith('No sh.keptn.events.evaluation-done event found for Keptn context')
				   )
				){
				if (++c > max){
					evaluationResult = "not-found"
				}
				else {
					console.log("wait another 10 seconds");
				}
			}
			else{
				throw err;
			}
		}
	}while (evaluationResult == "empty");

	handleEvaluationResult(evaluationResult, evaluationScore, keptnContext, input);

	console.log("************* Result from Keptn ****************");
	console.log(JSON.stringify(out, null, 2));

	return evaluationResult;
}

function handleEvaluationResult(evaluationResult:string, evaluationScore:number, keptnContext:string|undefined, input:Params){
	console.log("evaluationResult = " + evaluationResult);
	if (evaluationResult == "not-found"){
		tl.setResult(tl.TaskResult.Failed, "No Keptn sh.keptn.events.evaluation-done event found for context");
		return "No Keptn sh.keptn.events.evaluation-done event found for context";
	}
	else if (evaluationResult == "pass"){
		tl.setResult(tl.TaskResult.Succeeded, "Keptn evaluation went well. Score = " + evaluationScore);
	}
	else{
		let message =  "Keptn evaluation " +  evaluationResult + ". Score = " + evaluationScore;
		let markBuild = input.markBuildOn[evaluationResult];
		console.log("markBuild = " + markBuild);
		if (markBuild == 'NOTHING'){
			console.log(message);
		}
		else{
			tl.logIssue(logIssueMap[markBuild], message);
			tl.setResult(completeTaskMap[markBuild], message);
		}
	}
	if (input.keptnBridgeEndpoint != undefined){
		console.log("Link to Bridge: " + input.keptnBridgeEndpoint + "/trace/" + keptnContext);
	}
}

/**
 * Helper function to wait an amount of millis.
 * @param ms 
 */
function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main
 */
let input:Params | undefined = prepare();
if (input !== undefined){
	run(input).then(result => {
    	console.log(result);
	}).catch(err => {
		console.error(err);
	});
}
