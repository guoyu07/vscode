/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SpectronApplication } from '../../spectron/application';
import { Viewlet } from '../workbench/viewlet';

const VIEWLET = 'div[id="workbench.view.debug"]';
const DEBUG_VIEW = `${VIEWLET} .debug-view-content`;
const CONFIGURE = `div[id="workbench.parts.sidebar"] .actions-container .configure`;
const START = `.icon[title="Start Debugging"]`;
const STOP = `.debug-actions-widget .debug-action.stop`;
const STEP_OVER = `.debug-actions-widget .debug-action.step-over`;
const STEP_IN = `.debug-actions-widget .debug-action.step-into`;
const STEP_OUT = `.debug-actions-widget .debug-action.step-out`;
const CONTINUE = `.debug-actions-widget .debug-action.continue`;
const GLYPH_AREA = '.margin-view-overlays>:nth-child';
const BREAKPOINT_GLYPH = '.debug-breakpoint-glyph';
const PAUSE = `.debug-actions-widget .debug-action.pause`;
const DEBUG_STATUS_BAR = `.statusbar.debugging`;
const NOT_DEBUG_STATUS_BAR = `.statusbar:not(debugging)`;
const TOOLBAR_HIDDEN = `.debug-actions-widget.builder-hidden`;
const STACK_FRAME = `${VIEWLET} .monaco-tree-row .stack-frame`;
const VARIABLE = `${VIEWLET} .debug-variables .monaco-tree-row .expression`;
const CONSOLE_OUTPUT = `.repl .output.expression`;
const CONSOLE_INPUT_OUTPUT = `.repl .input-output-pair .output.expression .value`;
const SCOPE = `${VIEWLET} .debug-variables .scope`;

const REPL_FOCUSED = '.repl-input-wrapper .monaco-editor.focused';

export interface IStackFrame {
	id: string;
	name: string;
	lineNumber: number;
}

export class Debug extends Viewlet {

	constructor(spectron: SpectronApplication) {
		super(spectron);
	}

	async openDebugViewlet(): Promise<any> {
		await this.spectron.command('workbench.view.debug');
		await this.spectron.client.waitForElement(DEBUG_VIEW);
	}

	async configure(): Promise<any> {
		await this.spectron.client.waitAndClick(CONFIGURE);
		await this.spectron.workbench.waitForEditorFocus('launch.json');
	}

	async setBreakpointOnLine(lineNumber: number): Promise<any> {
		await this.spectron.client.waitForElement(`${GLYPH_AREA}(${lineNumber})`);
		await this.spectron.client.leftClick(`${GLYPH_AREA}(${lineNumber})`, 5, 5);
		await this.spectron.client.waitForElement(BREAKPOINT_GLYPH);
	}

	async startDebugging(): Promise<any> {
		await this.spectron.client.waitAndClick(START);
		await this.spectron.client.waitForElement(PAUSE);
		await this.spectron.client.waitForElement(DEBUG_STATUS_BAR);
	}

	async stepOver(): Promise<any> {
		await this.spectron.client.waitAndClick(STEP_OVER);
	}

	async stepIn(): Promise<any> {
		await this.spectron.client.waitAndClick(STEP_IN);
	}

	async stepOut(): Promise<any> {
		await this.spectron.client.waitAndClick(STEP_OUT);
	}

	async continue(): Promise<any> {
		await this.spectron.client.waitAndClick(CONTINUE);
		await this.waitForStackFrameLength(0);
	}

	async stopDebugging(): Promise<any> {
		await this.spectron.client.waitAndClick(STOP);
		await this.spectron.client.waitForElement(TOOLBAR_HIDDEN);
		await this.spectron.client.waitForElement(NOT_DEBUG_STATUS_BAR);
	}

	async waitForStackFrame(func: (stackFrame: IStackFrame) => boolean): Promise<IStackFrame> {
		return await this.spectron.client.waitFor(async () => {
			const stackFrames = await this.getStackFrames();
			return stackFrames.filter(func)[0];
		}, void 0, 'Waiting for Stack Frame');
	}

	async waitForStackFrameLength(length: number): Promise<any> {
		return await this.spectron.client.waitFor(() => this.getStackFrames(), stackFrames => stackFrames.length === length);
	}

	async focusStackFrame(name: string): Promise<any> {
		const stackFrame = await this.waitForStackFrame(sf => sf.name === name);
		await this.spectron.client.spectron.client.elementIdClick(stackFrame.id);
		await this.spectron.workbench.waitForOpen(name);
	}

	async console(text: string): Promise<string> {
		await this.spectron.workbench.quickopen.runCommand('Debug: Focus Debug Console');
		await this.spectron.client.waitForElement(REPL_FOCUSED);
		await this.spectron.client.type(text);
		await this.spectron.client.waitForElement(CONSOLE_INPUT_OUTPUT);

		const result = await this.getConsoleOutput();
		return result[result.length - 1] || '';
	}

	async getLocalVariableCount(): Promise<number> {
		await this.spectron.client.waitForElement(SCOPE);
		return await this.spectron.webclient.selectorExecute(VARIABLE, div => (Array.isArray(div) ? div : [div]).length);
	}

	async getStackFramesLength(): Promise<number> {
		const stackFrames = await this.getStackFrames();
		return stackFrames.length;
	}

	private async getStackFrames(): Promise<IStackFrame[]> {
		const result = await this.spectron.webclient.selectorExecute(STACK_FRAME,
			div => (Array.isArray(div) ? div : [div]).map(element => {
				const name = element.querySelector('.file-name') as HTMLElement;
				const line = element.querySelector('.line-number') as HTMLElement;
				const lineNumber = line.textContent ? parseInt(line.textContent.split(':').shift() || '0') : 0;

				return {
					name: name.textContent,
					lineNumber,
					element
				};
			})
		);

		if (!Array.isArray(result)) {
			return [];
		}

		return result
			.map(({ name, lineNumber, element }) => ({ name, lineNumber, id: element.ELEMENT }));
	}

	private async getConsoleOutput(): Promise<string[]> {
		const result = await this.spectron.webclient.selectorExecute(CONSOLE_OUTPUT,
			div => (Array.isArray(div) ? div : [div]).map(element => {
				const value = element.querySelector('.value') as HTMLElement;
				return value && value.textContent;
			}).filter(line => !!line)
		);

		return result;
	}
}
