import { Box, Button, ButtonGroup, Margins } from '@rocket.chat/fuselage';
import { useMutableCallback } from '@rocket.chat/fuselage-hooks';
import {
	useSetModal,
	useToastMessageDispatch,
	useQueryStringParameter,
	useRoute,
	useRouteParameter,
	useMethod,
	useTranslation,
} from '@rocket.chat/ui-contexts';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import React, { useEffect, useCallback } from 'react';

import Page from '../../../components/Page';
import ConnectToCloudSection from './ConnectToCloudSection';
import ManualWorkspaceRegistrationModal from './ManualWorkspaceRegistrationModal';
import TroubleshootingSection from './TroubleshootingSection';
import WhatIsItSection from './WhatIsItSection';
import WorkspaceLoginSection from './WorkspaceLoginSection';
import WorkspaceRegistrationSection from './WorkspaceRegistrationSection';
import { cloudConsoleUrl } from './constants';

const CloudPage = (): ReactNode => {
	const t = useTranslation();
	const setModal = useSetModal();
	const dispatchToastMessage = useToastMessageDispatch();

	const cloudRoute = useRoute('cloud');

	const shouldOpenManualRegistration = useQueryStringParameter('register');
	const page = useRouteParameter('page');

	const errorCode = useQueryStringParameter('error_code');
	const code = useQueryStringParameter('code');
	const state = useQueryStringParameter('state');
	const token = useQueryStringParameter('token');

	const finishOAuthAuthorization = useMethod('cloud:finishOAuthAuthorization');
	const checkCloudRegisterStatus = useMethod('cloud:checkRegisterStatus');
	const connectWorkspace = useMethod('cloud:connectWorkspace');

	const result = useQuery(['admin/cloud/register-status'], async () => checkCloudRegisterStatus());
	const reload = useMutableCallback(() => result.refetch());

	useEffect(() => {
		const acceptOAuthAuthorization = async (): Promise<void> => {
			if (page !== 'oauth-callback') {
				return;
			}

			if (errorCode) {
				dispatchToastMessage({
					type: 'error',
					title: t('Cloud_error_in_authenticating'),
					message: t('Cloud_error_code', { errorCode }),
				});
				cloudRoute.push();
				return;
			}

			try {
				await finishOAuthAuthorization(code, state);
			} catch (error) {
				dispatchToastMessage({ type: 'error', message: error });
			} finally {
				cloudRoute.push();
			}
		};

		acceptOAuthAuthorization();
	}, [errorCode, code, state, page, dispatchToastMessage, t, cloudRoute, finishOAuthAuthorization]);

	useEffect(() => {
		const acceptWorkspaceToken = async (): Promise<void> => {
			try {
				if (token) {
					const isConnected = await connectWorkspace(token);

					if (!isConnected) {
						throw Error(t('An error occured connecting' as Parameters<typeof t>[0]));
					}

					dispatchToastMessage({ type: 'success', message: t('Connected') });
				}
			} catch (error) {
				dispatchToastMessage({ type: 'error', message: error });
			} finally {
				reload();
			}
		};

		acceptWorkspaceToken();
	}, [reload, connectWorkspace, dispatchToastMessage, t, token]);

	const handleManualWorkspaceRegistrationButtonClick = useCallback((): void => {
		const handleModalClose = (): void => {
			setModal(null);
			reload();
		};
		setModal(<ManualWorkspaceRegistrationModal onClose={handleModalClose} />);
	}, [setModal, reload]);

	useEffect(() => {
		if (shouldOpenManualRegistration) {
			handleManualWorkspaceRegistrationButtonClick();
		}
	}, [shouldOpenManualRegistration, handleManualWorkspaceRegistrationButtonClick]);

	if (result.isLoading || result.isError) {
		return null;
	}

	const {
		connectToCloud: isConnectToCloudDesired,
		workspaceRegistered: isWorkspaceRegistered,
		email,
		token: resultToken,
		workspaceId,
		uniqueId,
	} = result.data;

	return (
		<Page>
			<Page.Header title={t('Connectivity_Services')}>
				<ButtonGroup>
					{!isWorkspaceRegistered && <Button onClick={handleManualWorkspaceRegistrationButtonClick}>{t('Cloud_Register_manually')}</Button>}
					<Button is='a' primary href={cloudConsoleUrl} target='_blank' rel='noopener noreferrer'>
						{t('Cloud_console')}
					</Button>
				</ButtonGroup>
			</Page.Header>
			<Page.ScrollableContentWithShadow>
				<Box marginInline='auto' marginBlock='neg-x24' width='full' maxWidth='x580'>
					<Margins block='x24'>
						<WhatIsItSection />

						{isConnectToCloudDesired && (
							<>
								{isWorkspaceRegistered ? (
									<>
										<WorkspaceLoginSection onRegisterStatusChange={reload} />
										<TroubleshootingSection onRegisterStatusChange={reload} />
									</>
								) : (
									<WorkspaceRegistrationSection
										email={email}
										token={resultToken}
										workspaceId={workspaceId}
										uniqueId={uniqueId}
										onRegisterStatusChange={reload}
									/>
								)}
							</>
						)}

						{!isConnectToCloudDesired && <ConnectToCloudSection onRegisterStatusChange={reload} />}
					</Margins>
				</Box>
			</Page.ScrollableContentWithShadow>
		</Page>
	);
};

export default CloudPage;
