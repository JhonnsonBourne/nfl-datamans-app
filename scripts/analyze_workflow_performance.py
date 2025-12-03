#!/usr/bin/env python3
"""
Analyze GitHub Actions workflow performance data
Extracts and analyzes performance metrics from workflow artifacts
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Any
from datetime import datetime
import statistics

def load_json_file(filepath: Path) -> Dict[str, Any]:
    """Load JSON file safely"""
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"⚠️  Error loading {filepath}: {e}")
        return {}

def analyze_performance_data(data_dir: Path) -> Dict[str, Any]:
    """Analyze performance data from workflow artifacts"""
    results = {
        'timestamp': datetime.now().isoformat(),
        'positions': {},
        'summary': {},
        'issues': []
    }
    
    # Find all performance JSON files
    perf_files = list(data_dir.glob('**/*performance*.json'))
    
    if not perf_files:
        print("⚠️  No performance data files found")
        return results
    
    print(f"📊 Found {len(perf_files)} performance data files")
    
    # Load and analyze each file
    position_data = {}
    for perf_file in perf_files:
        data = load_json_file(perf_file)
        
        if 'position' in data:
            position = data['position']
            if position not in position_data:
                position_data[position] = []
            position_data[position].append(data)
    
    # Analyze each position
    for position, datasets in position_data.items():
        if not datasets:
            continue
            
        # Calculate statistics
        filter_durations = [d.get('filterDuration', 0) for d in datasets]
        ui_blocks = [d.get('maxUIBlockDuration', 0) for d in datasets]
        api_durations = [d.get('apiCallDuration', 0) for d in datasets if d.get('apiCallDuration')]
        error_counts = [len(d.get('errors', [])) for d in datasets]
        
        results['positions'][position] = {
            'samples': len(datasets),
            'filterDuration': {
                'min': min(filter_durations) if filter_durations else 0,
                'max': max(filter_durations) if filter_durations else 0,
                'avg': statistics.mean(filter_durations) if filter_durations else 0,
                'median': statistics.median(filter_durations) if filter_durations else 0
            },
            'uiBlockDuration': {
                'min': min(ui_blocks) if ui_blocks else 0,
                'max': max(ui_blocks) if ui_blocks else 0,
                'avg': statistics.mean(ui_blocks) if ui_blocks else 0,
                'median': statistics.median(ui_blocks) if ui_blocks else 0
            },
            'apiCallDuration': {
                'min': min(api_durations) if api_durations else 0,
                'max': max(api_durations) if api_durations else 0,
                'avg': statistics.mean(api_durations) if api_durations else 0,
                'median': statistics.median(api_durations) if api_durations else 0
            },
            'errorCount': {
                'total': sum(error_counts),
                'avg': statistics.mean(error_counts) if error_counts else 0,
                'samples_with_errors': sum(1 for c in error_counts if c > 0)
            },
            'issues': []
        }
        
        # Detect issues
        pos_results = results['positions'][position]
        
        # Issue: Slow filter duration
        if pos_results['filterDuration']['avg'] > 3000:
            issue = {
                'type': 'slow_filter',
                'severity': 'high' if pos_results['filterDuration']['avg'] > 5000 else 'medium',
                'message': f"Average filter duration ({pos_results['filterDuration']['avg']:.0f}ms) exceeds 3s threshold",
                'position': position,
                'value': pos_results['filterDuration']['avg']
            }
            pos_results['issues'].append(issue)
            results['issues'].append(issue)
        
        # Issue: UI thread blocks
        if pos_results['uiBlockDuration']['max'] > 500:
            issue = {
                'type': 'ui_block',
                'severity': 'high' if pos_results['uiBlockDuration']['max'] > 2000 else 'medium',
                'message': f"UI thread blocked for {pos_results['uiBlockDuration']['max']:.0f}ms",
                'position': position,
                'value': pos_results['uiBlockDuration']['max']
            }
            pos_results['issues'].append(issue)
            results['issues'].append(issue)
        
        # Issue: Errors detected
        if pos_results['errorCount']['total'] > 0:
            issue = {
                'type': 'errors',
                'severity': 'high',
                'message': f"{pos_results['errorCount']['total']} errors detected across {pos_results['errorCount']['samples_with_errors']} samples",
                'position': position,
                'value': pos_results['errorCount']['total']
            }
            pos_results['issues'].append(issue)
            results['issues'].append(issue)
        
        # Issue: Slow API calls
        if api_durations and pos_results['apiCallDuration']['avg'] > 2000:
            issue = {
                'type': 'slow_api',
                'severity': 'medium',
                'message': f"Average API call duration ({pos_results['apiCallDuration']['avg']:.0f}ms) exceeds 2s threshold",
                'position': position,
                'value': pos_results['apiCallDuration']['avg']
            }
            pos_results['issues'].append(issue)
            results['issues'].append(issue)
    
    # Generate summary
    if position_data:
        all_filter_durations = []
        all_ui_blocks = []
        problematic_positions = []
        
        for position, data in results['positions'].items():
            all_filter_durations.extend([d.get('filterDuration', 0) for d in position_data[position]])
            all_ui_blocks.extend([d.get('maxUIBlockDuration', 0) for d in position_data[position]])
            
            if data['issues']:
                problematic_positions.append(position)
        
        results['summary'] = {
            'total_samples': sum(len(datasets) for datasets in position_data.values()),
            'positions_tested': list(position_data.keys()),
            'problematic_positions': problematic_positions,
            'overall_avg_filter_duration': statistics.mean(all_filter_durations) if all_filter_durations else 0,
            'overall_max_ui_block': max(all_ui_blocks) if all_ui_blocks else 0,
            'total_issues': len(results['issues']),
            'high_severity_issues': len([i for i in results['issues'] if i['severity'] == 'high']),
            'medium_severity_issues': len([i for i in results['issues'] if i['severity'] == 'medium'])
        }
    
    return results

def generate_report(analysis: Dict[str, Any], output_file: Path):
    """Generate a human-readable report"""
    report_lines = [
        "# Performance Analysis Report",
        f"Generated: {analysis['timestamp']}",
        "",
        "## Summary",
        f"- Total Samples: {analysis['summary'].get('total_samples', 0)}",
        f"- Positions Tested: {', '.join(analysis['summary'].get('positions_tested', []))}",
        f"- Problematic Positions: {', '.join(analysis['summary'].get('problematic_positions', [])) or 'None'}",
        f"- Overall Avg Filter Duration: {analysis['summary'].get('overall_avg_filter_duration', 0):.0f}ms",
        f"- Overall Max UI Block: {analysis['summary'].get('overall_max_ui_block', 0):.0f}ms",
        f"- Total Issues: {analysis['summary'].get('total_issues', 0)}",
        f"  - High Severity: {analysis['summary'].get('high_severity_issues', 0)}",
        f"  - Medium Severity: {analysis['summary'].get('medium_severity_issues', 0)}",
        "",
        "## Issues Detected",
    ]
    
    if analysis['issues']:
        for issue in sorted(analysis['issues'], key=lambda x: (x['severity'] == 'high', x['value']), reverse=True):
            report_lines.append(f"### {issue['type'].upper()} - {issue['severity'].upper()}")
            report_lines.append(f"- Position: {issue['position']}")
            report_lines.append(f"- Message: {issue['message']}")
            report_lines.append(f"- Value: {issue['value']:.0f}ms" if isinstance(issue['value'], (int, float)) else f"- Value: {issue['value']}")
            report_lines.append("")
    else:
        report_lines.append("✅ No issues detected!")
        report_lines.append("")
    
    report_lines.append("## Position Details")
    for position, data in analysis['positions'].items():
        report_lines.append(f"### {position}")
        report_lines.append(f"- Samples: {data['samples']}")
        report_lines.append(f"- Filter Duration: avg={data['filterDuration']['avg']:.0f}ms, max={data['filterDuration']['max']:.0f}ms")
        report_lines.append(f"- UI Block Duration: avg={data['uiBlockDuration']['avg']:.0f}ms, max={data['uiBlockDuration']['max']:.0f}ms")
        if data['apiCallDuration']['avg'] > 0:
            report_lines.append(f"- API Call Duration: avg={data['apiCallDuration']['avg']:.0f}ms, max={data['apiCallDuration']['max']:.0f}ms")
        report_lines.append(f"- Errors: {data['errorCount']['total']} total")
        if data['issues']:
            report_lines.append(f"- Issues: {len(data['issues'])}")
            for issue in data['issues']:
                report_lines.append(f"  - {issue['message']}")
        report_lines.append("")
    
    report_content = "\n".join(report_lines)
    
    with open(output_file, 'w') as f:
        f.write(report_content)
    
    print(f"✅ Report generated: {output_file}")

def main():
    """Main entry point"""
    # Default to workflow artifacts directory or current directory
    if len(sys.argv) > 1:
        data_dir = Path(sys.argv[1])
    else:
        data_dir = Path('workflow-artifacts')
    
    if not data_dir.exists():
        print(f"⚠️  Directory not found: {data_dir}")
        print("Usage: python analyze_workflow_performance.py [artifacts_directory]")
        sys.exit(1)
    
    print(f"📊 Analyzing performance data from: {data_dir}")
    
    # Analyze performance data
    analysis = analyze_performance_data(data_dir)
    
    # Save analysis JSON
    output_json = data_dir / 'performance_analysis.json'
    with open(output_json, 'w') as f:
        json.dump(analysis, f, indent=2)
    print(f"✅ Analysis saved: {output_json}")
    
    # Generate report
    output_report = data_dir / 'performance_report.md'
    generate_report(analysis, output_report)
    
    # Print summary to console
    print("\n" + "="*60)
    print("PERFORMANCE ANALYSIS SUMMARY")
    print("="*60)
    print(f"Total Issues: {analysis['summary'].get('total_issues', 0)}")
    print(f"High Severity: {analysis['summary'].get('high_severity_issues', 0)}")
    print(f"Problematic Positions: {', '.join(analysis['summary'].get('problematic_positions', [])) or 'None'}")
    print("="*60)

if __name__ == '__main__':
    main()

