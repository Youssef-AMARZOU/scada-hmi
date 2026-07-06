%% INDUS — MATLAB Predictive Maintenance Publisher
% Publie les predictions via le Node.js MQTT bridge.
% Utilisation:  >> predictive_model
%
%% Configuration
fprintf('=== INDUS - Predictive Publisher ===\n');

machines = {'Machine M1', 'Machine M2', 'Broyeur BR2', 'Compresseur C2', 'Pompe P3'};
features = [0.8, 72, 45, 1200; 2.1, 85, 52, 3400; 4.5, 98, 68, 5600; 0.5, 65, 40, 800; 1.2, 70, 48, 2100];
weights = [0.3, 0.25, 0.2, 0.25];
maxVals = [5, 100, 80, 6000];

% Detect node executable
[~, nodeCheck] = system('where node 2>nul');
if isempty(strtrim(nodeCheck))
    nodeCmd = '"C:\Program Files\nodejs\node.exe"';
else
    nodeCmd = 'node';
end

bridgeFile = fullfile(fileparts(mfilename('fullpath')), 'mqtt_bridge.js');

if ~exist(bridgeFile, 'file')
    error('Bridge introuvable: %s', bridgeFile);
end

%% Predictions
for i = 1:length(machines)
    normFeat = features(i,:) ./ maxVals;
    score = sum(normFeat .* weights);
    failureProb = 1 / (1 + exp(-10*(score - 0.5)));
    rul = max(0, round((1 - failureProb) * 1000));
    confidence = 0.85 + rand() * 0.1;

    prediction = struct(...
        'machine', machines{i}, ...
        'failure_probability', round(failureProb, 3), ...
        'estimated_rul_hours', rul, ...
        'confidence', round(confidence, 3), ...
        'status', ternary(failureProb>0.7,'CRITIQUE',ternary(failureProb>0.4,'Surveillance','Healthy')), ...
        'features', struct('vibration', features(i,1), 'temperature', features(i,2), ...
            'pressure', features(i,3), 'runtime_hours', features(i,4)), ...
        'timestamp', char(datetime('now', 'Format', 'yyyy-MM-dd''T''HH:mm:ss')));

    topic = sprintf('factory/predictions/maintenance/%s', strrep(machines{i}, ' ', '_'));
    msg = jsonencode(prediction);
    publishViaBridge(nodeCmd, bridgeFile, topic, msg);
    fprintf('Publie %s: P(fail)=%.1f%%, RUL=%dh\n', machines{i}, failureProb*100, rul);
end

%% OEE
oee = struct(...
    'availability', 87.5 + randn()*2, ...
    'performance', 92.3 + randn()*1.5, ...
    'quality', 97.8 + randn()*0.5, ...
    'timestamp', char(datetime('now', 'Format', 'yyyy-MM-dd''T''HH:mm:ss')));
oee.overall = oee.availability * oee.performance * oee.quality / 10000;
publishViaBridge(nodeCmd, bridgeFile, 'factory/predictions/oee', jsonencode(oee));
fprintf('OEE: %.1f%%\n', oee.overall);
fprintf('=== Termine ===\n');

%% Helper
function publishViaBridge(nodeCmd, script, topic, msg)
    tmpFile = [tempname, '_indus.json'];
    fid = fopen(tmpFile, 'w', 'n', 'UTF-8');
    fprintf(fid, '%s', msg);
    fclose(fid);
    system(sprintf('%s "%s" localhost:1883 "%s" --file "%s"', nodeCmd, script, topic, tmpFile));
    delete(tmpFile);
end

function r = ternary(c, t, f)
    if c, r = t; else, r = f; end
end
