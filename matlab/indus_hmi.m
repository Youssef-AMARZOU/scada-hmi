%% INDUS — MATLAB HMI Application
% Interface homme-machine pour maintenance predictive.
% Integration MQTT avec l'ecosysteme INDUS Electron.
%
% Usage:  indus_hmi
%
function indus_hmi
    fprintf('=== INDUS HMI - MATLAB Edition ===\n');
    fprintf('Initialisation...\n');

    % --- Data store (shared via nested functions) ---
    running = true;
    simTimer = [];
    mqttClient = [];
    mqttConnected = false;
    % Detect node.exe (may not be in PATH)
    [~, nodeCheck] = system('where node 2>nul');
    if isempty(strtrim(nodeCheck))
        nodeCmd = '"C:\Program Files\nodejs\node.exe"';
    else
        nodeCmd = 'node';
    end
    selectedMachine = 1;
    simulationSpeed = 1;
    timeStep = 1;
    anomalyMode = false;
    mqttPublish = true;
    bufferSize = 100;
    bufferIdx = 1;
    nMachines = 5;

    machines = {'M1 - Machine', 'M2 - Machine', 'BR2 - Broyeur', 'C2 - Compresseur', 'P3 - Pompe'};
    machineColors = {[0.2 0.6 1], [1 0.6 0], [1 0.3 0.3], [0.3 0.8 0.3], [0.7 0.3 0.8]};
    featureNames = {'Vibration (mm/s)', 'Temperature (C)', 'Pression (bar)', 'Runtime (h)'};
    featureMax  = [5, 100, 80, 6000];
    weights     = [0.3, 0.25, 0.2, 0.25];

    % Current values & history
    simData = [0.8, 72, 45, 1200; 2.1, 85, 52, 3400; 4.5, 98, 68, 5600; 0.5, 65, 40, 800; 1.2, 70, 48, 2100];
    failureProb = zeros(1, nMachines);
    rulHours   = zeros(1, nMachines);
    confidence = zeros(1, nMachines);
    status     = repmat({'Healthy'}, 1, nMachines);
    history    = struct('vibration', zeros(nMachines, bufferSize), ...
                        'temperature', zeros(nMachines, bufferSize), ...
                        'pressure', zeros(nMachines, bufferSize), ...
                        'failureProb', zeros(nMachines, bufferSize));

    % --- UI handles (filled during createUI) ---
    fig = []; lblStatus = []; btnPause = []; btnInject = []; lblMQTT = [];
    dashboardAxes = []; healthLabels = gobjects(0); statsLabels = gobjects(0);
    lines1 = gobjects(0); lines2 = gobjects(0);
    monitorGauges = []; predBars = []; lblPredSummary = []; fftLine = [];

    % --- Build UI ---
    createUI();

    % --- Main loop (replaces timer to avoid scoping issues) ---
    fprintf('HMI operationnelle. Fermer la fenetre pour arreter.\n');
    while isvalid(fig)
        updateSimulation();
        drawnow limitrate;
        pause(1.0);
    end

    % Cleanup
    if mqttConnected
        try clear mqttClient; catch, end
    end
    fprintf('=== HMI arretee. ===\n');

    % ====================================================================
    %   CREATE UI
    % ====================================================================
    function createUI()
        fig = uifigure('Name', 'INDUS - HMI Maintenance Predictive', ...
            'Position', [100, 100, 1400, 800], 'Resize', 'off', ...
            'CloseRequestFcn', @(~,~) closeApp());

        mainGrid = uigridlayout(fig, [3, 4], ...
            'RowHeight', {40, '1x', 30}, ...
            'ColumnWidth', {200, '1x', '1x', '1x'}, ...
            'Padding', [10,10,10,10]);

        % --- Header ---
        hdr = uipanel(mainGrid, 'Title', '', 'BackgroundColor', [0.1 0.1 0.2]);
        hdr.Layout.Row = 1; hdr.Layout.Column = [1,4];
        gh = uigridlayout(hdr, [1,4], 'ColumnWidth', {'1x', 200, 150, 150}, 'Padding', [10,0,10,0]);
        uilabel(gh, 'Text', 'INDUS - HMI Maintenance Predictive', ...
            'FontSize', 18, 'FontWeight', 'bold', 'FontColor', [1 1 1]);
        uilabel(gh, 'Text', 'Etat: EN ROUTE', 'FontSize', 14, ...
            'FontColor', [0.3 1 0.3], 'HorizontalAlignment', 'center');
        btnPause = uibutton(gh, 'push', 'Text', 'Pause', ...
            'ButtonPushedFcn', @(~,~) togglePause());
        btnInject = uibutton(gh, 'push', 'Text', 'Injecter Anomalie', ...
            'BackgroundColor', [1 0.6 0], ...
            'ButtonPushedFcn', @(~,~) toggleAnomaly());

        % --- Sidebar ---
        sb = uipanel(mainGrid, 'Title', 'Machines', 'FontWeight', 'bold', ...
            'BackgroundColor', [0.95 0.95 0.95]);
        sb.Layout.Row = 2; sb.Layout.Column = 1;
        gs = uigridlayout(sb, [nMachines+2, 1], ...
            'RowHeight', [repmat({35},1,nMachines), {20, 30}], 'Padding', [5,5,5,5]);
        for i = 1:nMachines
            uibutton(gs, 'push', 'Text', machines{i}, ...
                'BackgroundColor', machineColors{i}, ...
                'FontColor', [1 1 1], 'FontWeight', 'bold', ...
                'ButtonPushedFcn', @(~,~) selectMachine(i));
        end
        lblMQTT = uilabel(gs, 'Text', 'MQTT: deconnecte', 'FontSize', 11, ...
            'FontColor', [0.5 0.5 0.5], 'HorizontalAlignment', 'center');
        uibutton(gs, 'push', 'Text', 'Connecter MQTT', ...
            'ButtonPushedFcn', @(~,~) connectMQTT());

        % --- Tabs ---
        tg = uitabgroup(mainGrid);
        tg.Layout.Row = 2; tg.Layout.Column = [2,4];

        createDashboardTab(tg);
        createMonitoringTab(tg);
        createPredictionsTab(tg);
        createFFTTab(tg);
        createSettingsTab(tg);

        % --- Status bar ---
        st = uipanel(mainGrid, 'Title', '', 'BackgroundColor', [0.15 0.15 0.25]);
        st.Layout.Row = 3; st.Layout.Column = [1,4];
        lblStatus = uilabel(st, 'Text', 'Ready | Simulation 1s', ...
            'FontSize', 11, 'FontColor', [0.8 0.8 0.8], 'Position', [10,3,800,20]);
    end

    % ====================================================================
    %   TABS
    % ====================================================================
    function createDashboardTab(tg)
        tab = uitab(tg, 'Title', 'Dashboard');
        gl = uigridlayout(tab, [2,3], 'RowHeight', {'1x','1x'}, 'ColumnWidth', {'1x','1x','1x'}, 'Padding', [10,10,10,10]);

        p1 = uipanel(gl, 'Title', 'OEE Global', 'FontWeight', 'bold');
        p1.Layout.Row = 1; p1.Layout.Column = 1;
        uilabel(p1, 'Text', 'OEE = Disponibilite x Performance x Qualite', ...
            'Position', [10, 130, 250, 20]);
        dashboardAxes.OEE = uilamp(p1, 'Position', [120, 40, 60, 60]);
        lblOEE = uilabel(p1, 'Text', '--%', 'FontSize', 16, 'FontWeight', 'bold', ...
            'Position', [120, 10, 80, 30], 'HorizontalAlignment', 'center');
        dashboardAxes.lblOEE = lblOEE;

        p2 = uipanel(gl, 'Title', 'Etat des Machines', 'FontWeight', 'bold');
        p2.Layout.Row = 1; p2.Layout.Column = 2;
        gh = uigridlayout(p2, [nMachines, 2], 'ColumnWidth', {'1x', 70}, 'Padding', [5,5,5,5]);
        for i = 1:nMachines
            uilabel(gh, 'Text', machines{i});
            healthLabels(i) = uilabel(gh, 'Text', '--', 'HorizontalAlignment', 'center', 'FontWeight', 'bold');
        end

        p3 = uipanel(gl, 'Title', 'Indicateurs', 'FontWeight', 'bold');
        p3.Layout.Row = 1; p3.Layout.Column = 3;
        gs = uigridlayout(p3, [4,1], 'Padding', [5,5,5,5]);
        for i = 1:4
            statsLabels(i) = uilabel(gs, 'Text', '--', 'FontSize', 12, 'FontWeight', 'bold');
        end

        ax1 = uiaxes(gl); ax1.Layout.Row = 2; ax1.Layout.Column = 1;
        ax1.Title.String = 'Probabilite Defaillance'; ax1.YLim = [0 1]; ax1.Box = 'on';
        hold(ax1, 'on'); lines1 = gobjects(1, nMachines);
        for i = 1:nMachines, lines1(i) = plot(ax1, NaN, NaN, 'LineWidth', 1.5); end
        legend(lines1, machines, 'Location', 'eastoutside');

        ax2 = uiaxes(gl); ax2.Layout.Row = 2; ax2.Layout.Column = [2,3];
        ax2.Title.String = 'Vibration - Historique'; ax2.Box = 'on';
        hold(ax2, 'on'); lines2 = gobjects(1, nMachines);
        for i = 1:nMachines, lines2(i) = plot(ax2, NaN, NaN, 'LineWidth', 1.5); end
        legend(lines2, machines, 'Location', 'eastoutside');
    end

    function createMonitoringTab(tg)
        tab = uitab(tg, 'Title', 'Monitoring Temps Reel');
        gl = uigridlayout(tab, [2,3], 'RowHeight', {'1x','1x'}, 'ColumnWidth', {'1x','1x','1x'});
        monitorGauges = gobjects(nMachines, 4);
        for i = 1:nMachines
            row = ceil(i/3); col = mod(i-1,3)+1;
            p = uipanel(gl, 'Title', machines{i}, 'FontWeight', 'bold');
            p.Layout.Row = row; p.Layout.Column = col;
            gg = uigridlayout(p, [4,2], 'ColumnWidth', {'1x', 80}, 'RowHeight', repmat({25},1,4));
            for j = 1:4
                uilabel(gg, 'Text', featureNames{j});
                monitorGauges(i,j) = uilabel(gg, 'Text', '--', ...
                    'HorizontalAlignment', 'center', 'FontWeight', 'bold');
            end
        end
    end

    function createPredictionsTab(tg)
        tab = uitab(tg, 'Title', 'Predictions & RUL');
        gl = uigridlayout(tab, [2,1], 'RowHeight', {60, '1x'}, 'Padding', [10,10,10,10]);
        sp = uipanel(gl, 'Title', 'Resume');
        sp.Layout.Row = 1;
        lblPredSummary = uilabel(sp, 'Text', 'Chargement...', 'FontSize', 14, ...
            'FontWeight', 'bold', 'Position', [10, 10, 1000, 30]);

        ax = uiaxes(gl); ax.Layout.Row = 2;
        ax.Title.String = 'RUL estime (heures)'; ax.YLim = [0 1200]; ax.Box = 'on';
        ax.XTickLabel = machines; ax.XTickLabelRotation = 20;
        hold(ax, 'on'); yline(ax, 200, 'r--', 'Seuil critique', 'LineWidth', 1.5);
        predBars = bar(ax, 1:nMachines, zeros(1, nMachines), 'FaceColor', 'flat');
    end

    function createFFTTab(tg)
        tab = uitab(tg, 'Title', 'Analyse FFT');
        gl = uigridlayout(tab, [1,1], 'Padding', [10,10,10,10]);
        ax = uiaxes(gl); ax.Title.String = 'Analyse Frequentielle - Vibration';
        ax.XLabel.String = 'Frequence (Hz)'; ax.YLabel.String = 'Amplitude';
        ax.Box = 'on'; hold(ax, 'on');
        fftLine = plot(ax, NaN, NaN, 'b', 'LineWidth', 1.5);
    end

    function createSettingsTab(tg)
        tab = uitab(tg, 'Title', 'Configuration');
        gl = uigridlayout(tab, [6,2], 'ColumnWidth', {150, '1x'}, ...
            'RowHeight', repmat({35},1,6), 'Padding', [20,20,20,20]);
        uilabel(gl, 'Text', 'Vitesse simulation:'); uislider(gl, 'Limits', [0.1,5], 'Value', 1, ...
            'ValueChangedFcn', @(~,e) assignin('caller','simulationSpeed',e.Value));
        uilabel(gl, 'Text', 'Pas de temps (h):'); uislider(gl, 'Limits', [0.5,10], 'Value', 1, ...
            'ValueChangedFcn', @(~,e) assignin('caller','timeStep',e.Value));
        uilabel(gl, 'Text', 'Publication MQTT:'); uiswitch(gl, 'toggle', ...
            'Items', {'Off', 'On'}, 'Value', 'On', ...
            'ValueChangedFcn', @(~,e) assignin('caller','mqttPublish',strcmp(e.Value,'On')));
        uilabel(gl, 'Text', 'Reset simulation:'); uibutton(gl, 'push', 'Text', 'Reinitialiser', ...
            'BackgroundColor', [1 0.4 0.4], 'ButtonPushedFcn', @(~,~) resetSim());
        uilabel(gl, 'Text', 'Export rapport:'); uibutton(gl, 'push', 'Text', 'Exporter PNG', ...
            'BackgroundColor', [0.4 0.6 1], 'ButtonPushedFcn', @(~,~) exportReport());
    end

    % ====================================================================
    %   CORE LOOP (called by timer every ~1s)
    % ====================================================================
    function updateSimulation()
        if ~running || ~isvalid(fig), return; end

        % Update each machine
        for i = 1:nMachines
            simData(i,4) = simData(i,4) + simulationSpeed * timeStep;
            deg = simData(i,4) / 10000 * 2;
            noise = randn * 0.1;
            simData(i,1) = max(0.2, simData(i,1) + deg*0.05 + noise*0.2);
            simData(i,2) = min(120, simData(i,2) + deg*0.3 + noise*1);
            simData(i,3) = min(100, simData(i,3) + deg*0.2 + noise*0.5);

            if anomalyMode && mod(bufferIdx, 20) == 0 && i == 3
                simData(i,1) = simData(i,1) + 4;
                simData(i,2) = simData(i,2) + 20;
            end

            % Store history
            idx = mod(bufferIdx-1, bufferSize) + 1;
            history.vibration(i, idx) = simData(i,1);
            history.temperature(i, idx) = simData(i,2);
            history.pressure(i, idx) = simData(i,3);

            % Prediction
            normFeat = simData(i,:) ./ featureMax;
            score = sum(normFeat .* weights);
            failureProb(i) = 1 / (1 + exp(-10*(score - 0.5)));
            rulHours(i) = max(0, round((1 - failureProb(i)) * 1000));
            confidence(i) = 0.85 + rand*0.1;
            history.failureProb(i, idx) = failureProb(i);

            if failureProb(i) > 0.7, status{i} = 'CRITIQUE';
            elseif failureProb(i) > 0.4, status{i} = 'Surveillance';
            else, status{i} = 'Healthy'; end
        end
        bufferIdx = bufferIdx + 1;

        % MQTT
        if mqttConnected && mqttPublish, publishMQTT(); end

        % Update UI
        refreshUI();
    end

    % ====================================================================
    %   UI REFRESH
    % ====================================================================
    function refreshUI()
        % Machine health
        for i = 1:nMachines
            switch status{i}
                case 'CRITIQUE',     c = [1 0.2 0.2]; t = 'CRITIQUE';
                case 'Surveillance', c = [1 0.8 0];   t = 'Surveillance';
                otherwise,           c = [0.2 0.8 0.2]; t = 'OK';
            end
            healthLabels(i).Text = t;
            healthLabels(i).FontColor = c;
        end

        % Stats
        statsLabels(1).Text = sprintf('Taux defaillance moyen: %.1f%%', mean(failureProb)*100);
        statsLabels(2).Text = sprintf('RUL moyen: %.0f h', mean(rulHours));
        statsLabels(3).Text = sprintf('Machines critiques: %d', sum(failureProb > 0.7));
        statsLabels(4).Text = sprintf('Confiance modele: %.1f%%', mean(confidence)*100);

        % OEE
        avail = 87.5 + randn*2; perf = 92.3 + randn*1.5; qual = 97.8 + randn*0.5;
        oee = avail * perf * qual / 10000;
        if isfield(dashboardAxes, 'lblOEE') && isvalid(dashboardAxes.lblOEE)
            dashboardAxes.lblOEE.Text = sprintf('%.1f%%', oee);
        end

        % Trend lines
        for i = 1:nMachines
            set(lines1(i), 'YData', history.failureProb(i,:), 'XData', 1:bufferSize);
            set(lines2(i), 'YData', history.vibration(i,:), 'XData', 1:bufferSize);
        end

        % Monitoring gauges
        for i = 1:nMachines
            for j = 1:4
                val = simData(i,j); ratio = val / featureMax(j);
                lbl = monitorGauges(i,j);
                if isvalid(lbl)
                    lbl.Text = sprintf('%.1f', val);
                    if ratio > 0.8, lbl.FontColor = [1 0 0];
                    elseif ratio > 0.5, lbl.FontColor = [1 0.8 0];
                    else, lbl.FontColor = [0 0.6 0]; end
                end
            end
        end

        % RUL bars
        if isvalid(predBars)
            predBars.YData = rulHours;
            colors = zeros(nMachines, 3);
            for i = 1:nMachines
                if rulHours(i) < 200, colors(i,:) = [1 0.2 0.2];
                elseif rulHours(i) < 500, colors(i,:) = [1 0.8 0];
                else, colors(i,:) = [0.2 0.8 0.2]; end
            end
            predBars.CData = colors;
        end

        if isvalid(lblPredSummary)
            lblPredSummary.Text = sprintf('Predictions: %d machines | RUL moyen: %.0fh | Critiques: %d | Seuil: 200h', ...
                nMachines, mean(rulHours), sum(rulHours < 200));
        end

        % FFT
        if ~isempty(fftLine) && isvalid(fftLine)
            fs = 100; tVec = 0:1/fs:5;
            vib = simData(selectedMachine, 1);
            ff = 5 + vib*3;
            sig = vib*sin(2*pi*ff*tVec) + 0.3*vib*sin(2*pi*2*ff*tVec) + 0.1*randn(size(tVec));
            nfft = 256; f = fs*(0:(nfft/2))/nfft;
            Y = abs(fft(sig, nfft)/nfft); P = Y(1:nfft/2+1);
            set(fftLine, 'XData', f, 'YData', P);
        end

        % Status
        lblStatus.Text = sprintf('Running | t=%.0fh | Iter=%d | MQTT=%s | Anomalie=%s', ...
            simData(1,4), bufferIdx, ternary(mqttConnected,'ON','OFF'), ternary(anomalyMode,'ON','OFF'));
    end

    % ====================================================================
    %   MQTT
    % ====================================================================
    function publishMQTT()
        persistent lastPub
        if isempty(lastPub), lastPub = datetime('now') - seconds(5); end
        if seconds(datetime('now') - lastPub) < 3, return; end
        lastPub = datetime('now');

        bridgeScript = fullfile(fileparts(mfilename('fullpath')), 'mqtt_bridge.js');
        if ~exist(bridgeScript, 'file'), return; end

        for i = 1:nMachines
            topic = sprintf('factory/predictions/maintenance/%s', strrep(machines{i},' ','_'));
            msg = jsonencode(struct('machine',machines{i}, ...
                'failure_probability',round(failureProb(i),3), ...
                'estimated_rul_hours',rulHours(i), 'status',status{i}, ...
                'confidence',round(confidence(i),3), ...
                'features',struct('vibration',simData(i,1),'temperature',simData(i,2), ...
                    'pressure',simData(i,3),'runtime_hours',simData(i,4)), ...
                'timestamp',char(datetime('now','Format','yyyy-MM-dd''T''HH:mm:ss'))));
            publishViaBridge(bridgeScript, topic, msg);
        end
        % OEE
        oee = struct('availability',87.5+randn*2,'performance',92.3+randn*1.5, ...
            'quality',97.8+randn*0.5);
        oee.overall = oee.availability * oee.performance * oee.quality / 10000;
        oee.timestamp = char(datetime('now','Format','yyyy-MM-dd''T''HH:mm:ss'));
        publishViaBridge(bridgeScript, 'factory/predictions/oee', jsonencode(oee));
    end

    function publishViaBridge(script, topic, msg)
        % Try MATLAB toolbox (shared via nested function scope)
        try
            if ~isempty(mqttClient) && isvalid(mqttClient)
                write(mqttClient, topic, msg);
                return;
            end
        catch
        end
        % Fallback: Node.js bridge
        tmpFile = [tempname, '_indus.json'];
        fid = fopen(tmpFile, 'w', 'n', 'UTF-8');
        fprintf(fid, '%s', msg);
        fclose(fid);
        system(sprintf('%s "%s" localhost:1883 "%s" --file "%s"', nodeCmd, script, topic, tmpFile));
        delete(tmpFile);
    end

    function connectMQTT()
        lblMQTT.Text = 'MQTT: tentative...'; lblMQTT.FontColor = [0.5 0.5 0.5];
        drawnow;

        % Check broker
        [~, tasklist] = system('tasklist /FI "IMAGENAME eq mosquitto.exe" 2>nul');
        if ~contains(tasklist, 'mosquitto.exe')
            lblMQTT.Text = 'MQTT: broker arreté'; lblMQTT.FontColor = [1 0.5 0];
            fprintf('MQTT: Mosquitto ne tourne pas.\n');
            return;
        end

        % Try MATLAB toolbox
        if exist('mqttclient', 'file') == 2
            try
                mqttClient = mqttclient("tcp://localhost:1883");
                mqttConnected = true;
                lblMQTT.Text = 'MQTT: connecte (MATLAB)'; lblMQTT.FontColor = [0 0.6 0];
                fprintf('MQTT OK (MATLAB toolbox)\n');
                return;
            catch e
                fprintf('MATLAB toolbox: %s\n', e.message);
            end
        end

        % Fallback: Node.js bridge
        bridgeScript = fullfile(fileparts(mfilename('fullpath')), 'mqtt_bridge.js');
        if exist(bridgeScript, 'file')
            [status, ~] = system(sprintf('%s "%s" localhost:1883 test ping', nodeCmd, bridgeScript));
            if status == 0
                mqttConnected = true;
                lblMQTT.Text = 'MQTT: connecte (Node.js)'; lblMQTT.FontColor = [0 0.6 0];
                fprintf('MQTT OK (Node.js bridge)\n');
                return;
            end
        end

        lblMQTT.Text = 'MQTT: echec connection'; lblMQTT.FontColor = [1 0 0];
        fprintf('MQTT: aucun bridge disponible.\n');
    end

    % ====================================================================
    %   CALLBACKS
    % ====================================================================
    function selectMachine(i)
        selectedMachine = i;
        fprintf('Machine: %s\n', machines{i});
    end

    function togglePause()
        running = ~running;
        btnPause.Text = ternary(running, 'Pause', 'Reprendre');
        btnPause.BackgroundColor = ternary(running, [0.8 0.8 0.8], [0.3 1 0.3]);
    end

    function toggleAnomaly()
        anomalyMode = ~anomalyMode;
        btnInject.Text = ternary(anomalyMode, 'Arreter Anomalie', 'Injecter Anomalie');
        btnInject.BackgroundColor = ternary(anomalyMode, [1 0 0], [1 0.6 0]);
    end

    function resetSim()
        simData = [0.8,72,45,1200; 2.1,85,52,3400; 4.5,98,68,5600; 0.5,65,40,800; 1.2,70,48,2100];
        bufferIdx = 1;
        history.vibration = zeros(nMachines, bufferSize);
        history.temperature = zeros(nMachines, bufferSize);
        history.pressure = zeros(nMachines, bufferSize);
        history.failureProb = zeros(nMachines, bufferSize);
        fprintf('Simulation reinitialisee.\n');
    end

    function exportReport()
        f = figure('Visible', 'off', 'Position', [100,100,800,600]);
        subplot(2,2,1); bar(rulHours); set(gca,'XTickLabel',machines); xtickangle(20);
        ylabel('RUL (h)'); title('RUL par Machine'); yline(200,'r--','Seuil');
        subplot(2,2,2); bar(failureProb*100); set(gca,'XTickLabel',machines); xtickangle(20);
        ylabel('P(defaillance) %'); title('Probabilite Defaillance');
        subplot(2,2,3); plot(history.vibration(selectedMachine,:),'b-','LineWidth',1.5);
        xlabel('Iter'); ylabel('Vibration (mm/s)'); title(sprintf('Vibration - %s',machines{selectedMachine})); grid on;
        subplot(2,2,4); plot(history.temperature(selectedMachine,:),'r-','LineWidth',1.5);
        xlabel('Iter'); ylabel('Temperature (C)'); title(sprintf('Temperature - %s',machines{selectedMachine})); grid on;
        sgtitle(sprintf('INDUS - Rapport Maintenance (%s)', datestr(now)));
        saveas(f, 'INDUS_Report.png'); close(f);
        fprintf('Rapport: INDUS_Report.png\n');
    end

    function closeApp()
        running = false; delete(fig);
    end
end

function r = ternary(c, t, f)
    if c, r = t; else, r = f; end
end
