// src/components/vendor/SalesChart.js
import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';

const { width } = Dimensions.get('window');

export const SalesChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No sales data available</Text>
      </View>
    );
  }

  const chartWidth = width - 64;
  const chartHeight = 200;
  const barWidth = (chartWidth - 40) / data.length - 4;
  
  const maxSales = Math.max(...data.map(item => item.sales), 1);
  
  return (
    <View style={styles.container}>
      <Svg width={chartWidth} height={chartHeight}>
        {/* Y-axis line */}
        <Line
          x1="30"
          y1="10"
          x2="30"
          y2={chartHeight - 30}
          stroke="#E5E7EB"
          strokeWidth="1"
        />
        {/* X-axis line */}
        <Line
          x1="30"
          y1={chartHeight - 30}
          x2={chartWidth - 10}
          y2={chartHeight - 30}
          stroke="#E5E7EB"
          strokeWidth="1"
        />
        
        {/* Bars */}
        {data.map((item, index) => {
          const barHeight = (item.sales / maxSales) * (chartHeight - 60);
          const x = 35 + index * (barWidth + 8);
          const y = chartHeight - 30 - barHeight;
          
          return (
            <React.Fragment key={index}>
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill="#FF6B6B"
                rx="4"
              />
              <SvgText
                x={x + barWidth / 2}
                y={chartHeight - 15}
                fontSize="10"
                fill="#6B7280"
                textAnchor="middle"
              >
                {item.date}
              </SvgText>
              {item.sales > 0 && (
                <SvgText
                  x={x + barWidth / 2}
                  y={y - 5}
                  fontSize="10"
                  fill="#FF6B6B"
                  textAnchor="middle"
                >
                  ₱{item.sales}
                </SvgText>
              )}
            </React.Fragment>
          );
        })}
      </Svg>
      <View style={styles.legend}>
        <View style={styles.legendDot} />
        <Text style={styles.legendText}>Daily Sales (₱)</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF6B6B',
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#6B7280',
  },
});