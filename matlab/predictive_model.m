%% INDUS — MATLAB Predictive Maintenance Publisher
% This script runs predictive analytics and publishes results via MQTT
% to the INDUS Electron platform.
%
% Prerequisites: 
%   - MATLAB R2024a+ (built-in mqtt function)
%   - Mosquitto MQTT broker running on localhost:1883
%
% Usage: Run this script to send predictions to the dashboard.

%% Connect to MQTT Broker
fprintf('Connecting to MQTT broker...\n');
mqClient = mqttclient("tcp://localhost", Port=1883);
fprintf('Connected successfully.\n');

%% Simulated Machine Data (replace with real sensor data)
machines = {'Machine M1', 'Machine M2', 'Broyeur BR2', 'Compresseur C2', 'Pompe P3'};

% Feature vectors: [vibration, temperature, pressure, runtime_hours]
features = [
    0.8, 72, 45, 1200;   % M1 - healthy
    2.1, 85, 52, 3400;   % M2 - degrading 
    4.5, 98, 68, 5600;   % BR2 - near failure
    0.5, 65, 40, 800;    % C2 - healthy
    1.2, 70, 48, 2100;   % P3 - healthy
];

%% Simple Predictive Model (Logistic Regression)
% Normalized failure probability based on feature weights
weights = [0.3, 0.25, 0.2, 0.25]; % vibration, temp, pressure, runtime
maxVals = [5, 100, 80, 6000];     % normalization factors

for i = 1:length(machines)
    % Normalize features
    normFeatures = features(i,:) ./ maxVals;
    
    % Calculate failure probability (sigmoid)
    score = sum(normFeatures .* weights);
    failureProb = 1 / (1 + exp(-10*(score - 0.5)));
    
    % Estimate remaining useful life (RUL)
    rul_hours = max(0, round((1 - failureProb) * 1000));
    
    % Confidence based on data quality
    confidence = 0.85 + rand() * 0.1;
    
    % Build prediction struct
    prediction = struct(...
        'machine', machines{i}, ...
        'failure_probability', round(failureProb, 3), ...
        'estimated_rul_hours', rul_hours, ...
        'confidence', round(confidence, 3), ...
        'features', struct(...
            'vibration', features(i,1), ...
            'temperature', features(i,2), ...
            'pressure', features(i,3), ...
            'runtime_hours', features(i,4) ...
        ), ...
        'timestamp', char(datetime('now', 'Format', 'yyyy-MM-dd''T''HH:mm:ss')) ...
    );
    
    % Publish to MQTT
    topic = sprintf('factory/predictions/maintenance/%s', strrep(machines{i}, ' ', '_'));
    write(mqClient, topic, jsonencode(prediction));
    fprintf('Published prediction for %s: P(fail)=%.1f%%, RUL=%dh\n', ...
        machines{i}, failureProb*100, rul_hours);
end

%% OEE Analysis
oee_data = struct(...
    'availability', 87.5 + randn()*2, ...
    'performance', 92.3 + randn()*1.5, ...
    'quality', 97.8 + randn()*0.5, ...
    'timestamp', char(datetime('now', 'Format', 'yyyy-MM-dd''T''HH:mm:ss')) ...
);
oee_data.overall = oee_data.availability * oee_data.performance * oee_data.quality / 10000;

write(mqClient, 'factory/analytics/oee', jsonencode(oee_data));
fprintf('\nOEE Published: %.1f%% (A=%.1f%%, P=%.1f%%, Q=%.1f%%)\n', ...
    oee_data.overall, oee_data.availability, oee_data.performance, oee_data.quality);

fprintf('\nAll predictions published successfully!\n');
fprintf('The INDUS dashboard will display these in the Analytics module.\n');
