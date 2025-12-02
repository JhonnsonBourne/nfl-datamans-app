# Player Similarity Analysis & Optimization Opportunities

## Current Implementation

### Method: Weighted Euclidean Distance with Normalization

The current similarity calculation uses a **weighted Euclidean distance** approach:

1. **Base Volume Stats**: Position-specific career totals (yards, TDs, EPA, etc.)
2. **Efficiency Metrics**: Per-attempt, per-game, and rate-based metrics
3. **Weighting Scheme**:
   - Volume stats: Weight = 1.0
   - Efficiency metrics: Weight = 1.5
   - EPA metrics: Weight = 2.0 (highest priority)
   - Per-game metrics: Weight = 1.8

4. **Normalization**: Each stat is normalized by the maximum value between the two players
5. **Distance Calculation**: 
   ```
   distance = sqrt(sum(weighted_normalized_differences²) / sum(weights))
   similarity = max(0, 100 - (distance * 50))
   ```

### Strengths
- ✅ Handles multiple stat types (volume + efficiency)
- ✅ Weighted to prioritize efficiency/EPA metrics
- ✅ Normalized to handle different scales
- ✅ Position-specific stat selection

### Limitations
1. **Equal Weighting Within Categories**: All volume stats weighted equally, all efficiency stats weighted equally (except EPA)
2. **Linear Distance**: Assumes linear relationships (e.g., 1000 yards vs 2000 yards is same difference as 5000 vs 6000)
3. **No Dimensionality Reduction**: Uses all stats directly (could have redundancy)
4. **No Clustering**: Doesn't identify player archetypes/clusters
5. **Sensitive to Outliers**: Single extreme stat can dominate

---

## Alternative Data Science Approaches

### 1. **Principal Component Analysis (PCA) + Cosine Similarity**
**Concept**: Reduce dimensionality, then measure angle between vectors

**Pros**:
- Handles correlated stats automatically
- Reduces noise from redundant metrics
- Cosine similarity measures direction, not magnitude (good for player "style")

**Cons**:
- Less interpretable (components are linear combinations)
- Requires careful feature scaling
- May lose important single-stat signals

**Implementation**:
```python
from sklearn.decomposition import PCA
from sklearn.metrics.pairwise import cosine_similarity

# Standardize features
scaler = StandardScaler()
scaled_stats = scaler.fit_transform(player_stats_matrix)

# Reduce dimensions (e.g., to 10-15 components explaining 90% variance)
pca = PCA(n_components=0.9)  # Keep 90% variance
reduced_stats = pca.fit_transform(scaled_stats)

# Calculate cosine similarity
similarity_matrix = cosine_similarity(reduced_stats)
```

---

### 2. **K-Means Clustering + Cluster-Based Similarity**
**Concept**: Group players into clusters, then compare within/across clusters

**Pros**:
- Identifies player archetypes (e.g., "possession WR", "deep threat", "slot receiver")
- More interpretable results
- Can handle non-linear relationships

**Cons**:
- Requires choosing number of clusters (k)
- May miss nuanced differences within clusters
- Players near cluster boundaries may be misclassified

**Implementation**:
```python
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

# Cluster players
kmeans = KMeans(n_clusters=10, random_state=42)
clusters = kmeans.fit_predict(scaled_stats)

# Similarity = distance within cluster + cluster similarity
# Players in same cluster = more similar
```

---

### 3. **Random Forest / Gradient Boosting Similarity**
**Concept**: Train tree-based model to predict player "type", use leaf node similarity

**Pros**:
- Handles non-linear relationships
- Feature importance automatically learned
- Can incorporate interactions between stats

**Cons**:
- Requires training data (player labels/types)
- More complex to implement
- Less interpretable

---

### 4. **Mahalanobis Distance**
**Concept**: Euclidean distance adjusted for covariance between features

**Pros**:
- Accounts for correlations between stats
- More statistically rigorous
- Better handles multivariate normal distributions

**Cons**:
- Requires covariance matrix (needs sufficient data)
- Assumes multivariate normality
- More computationally expensive

**Implementation**:
```python
from scipy.spatial.distance import mahalanobis

# Calculate covariance matrix
cov_matrix = np.cov(player_stats_matrix.T)
inv_cov = np.linalg.inv(cov_matrix)

# Calculate Mahalanobis distance
distance = mahalanobis(player1_stats, player2_stats, inv_cov)
```

---

### 5. **Neural Network Embeddings (Deep Learning)**
**Concept**: Train neural network to learn player representations in low-dimensional space

**Pros**:
- Can learn complex non-linear relationships
- Automatically learns feature importance
- Can incorporate additional context (team, era, etc.)

**Cons**:
- Requires large dataset and training time
- Black box (less interpretable)
- Overkill for current use case

---

### 6. **Improved Weighted Euclidean (Hybrid Approach)**
**Concept**: Enhance current method with better weighting and normalization

**Improvements**:
- **Percentile-based normalization**: Instead of max value, use percentiles (less sensitive to outliers)
- **Dynamic weighting**: Learn weights from data (e.g., which stats best predict player success)
- **Stat grouping**: Group correlated stats and weight groups
- **Era adjustment**: Normalize for era (e.g., passing stats higher in modern era)

**Example**:
```python
# Percentile normalization
def percentile_normalize(val, all_values):
    percentile = (all_values < val).mean() * 100
    return percentile / 100  # Scale to 0-1

# Dynamic weights based on variance explained
weights = calculate_feature_importance(player_stats_matrix)
```

---

## Recommended Approach: **Hybrid Method**

### Phase 1: Immediate Improvements (Low Risk)
1. **Percentile-based normalization** instead of max-value normalization
2. **Era adjustment**: Normalize stats by season averages (e.g., 2025 passing yards vs 2000 passing yards)
3. **Better stat grouping**: Group correlated stats and apply group-level weighting
4. **Outlier handling**: Cap extreme values or use robust statistics (median, IQR)

### Phase 2: Advanced Methods (Medium Risk)
1. **PCA + Cosine Similarity**: Reduce dimensionality, then use cosine similarity
   - Keep top 10-15 components explaining 90% variance
   - More robust to redundant stats
   - Better captures player "style"

2. **Clustering Pre-filter**: Use K-means to identify player archetypes first
   - Compare within same cluster = higher similarity
   - Compare across clusters = lower similarity
   - More interpretable results

### Phase 3: Machine Learning (Higher Risk, Higher Reward)
1. **Learn weights from data**: Use regression/ML to determine which stats best predict player outcomes
2. **Neural embeddings**: Train model to learn optimal player representations
3. **Ensemble methods**: Combine multiple similarity metrics

---

## Performance Optimization

### Current Bottlenecks
1. **Routes calculation**: Loading PBP/participation for all seasons (FIXED: now position-specific)
2. **Iterating over all players**: O(n) comparison for each query
3. **Repeated calculations**: Efficiency metrics calculated multiple times

### Optimization Strategies

1. **Pre-compute and Cache**:
   - Pre-calculate routes for all WRs/TEs (one-time batch job)
   - Cache career aggregations
   - Store similarity matrices (if static)

2. **Indexing**:
   - Create database/index of player stats
   - Use approximate nearest neighbors (ANN) for fast similarity search

3. **Approximate Methods**:
   - Use locality-sensitive hashing (LSH) for fast similarity search
   - Sample subset of players for comparison (if dataset is huge)

4. **Parallel Processing**:
   - Calculate similarities in parallel batches
   - Use multiprocessing for routes calculation

---

## Implementation Priority

### High Priority (Quick Wins)
1. ✅ **Optimize routes calculation** (DONE: position-specific, batch processing)
2. **Add percentile normalization** (reduces outlier sensitivity)
3. **Add era adjustment** (normalize for league-wide stat inflation)
4. **Cache career aggregations** (avoid recalculating on each request)

### Medium Priority (Significant Improvements)
1. **PCA + Cosine Similarity** (better handles correlated stats)
2. **Clustering pre-filter** (more interpretable results)
3. **Dynamic weighting** (learn optimal weights from data)

### Low Priority (Future Exploration)
1. **Neural embeddings** (if we have large labeled dataset)
2. **Ensemble methods** (combine multiple similarity metrics)
3. **Real-time learning** (update similarity model as new data arrives)

---

## Example: Improved Similarity Calculation

```python
def improved_similarity(player1, player2, position, all_players_stats):
    """
    Enhanced similarity with percentile normalization and era adjustment
    """
    # 1. Era adjustment: Normalize stats by league averages for that season
    era_adjusted_stats = adjust_for_era(player1, player2, all_players_stats)
    
    # 2. Percentile normalization (instead of max-value)
    normalized_stats = {}
    for stat in base_stats:
        all_values = [p[stat] for p in all_players_stats]
        p1_percentile = percentile_rank(player1[stat], all_values)
        p2_percentile = percentile_rank(player2[stat], all_values)
        normalized_stats[stat] = (p1_percentile, p2_percentile)
    
    # 3. Group-based weighting
    volume_group = ['yards', 'tds', 'receptions']
    efficiency_group = ['per_attempt', 'per_game', 'rate']
    epa_group = ['epa']
    
    # 4. Calculate weighted distance
    distance = calculate_grouped_weighted_distance(
        normalized_stats,
        groups=[volume_group, efficiency_group, epa_group],
        group_weights=[1.0, 1.5, 2.0]
    )
    
    return 100 - (distance * 50)
```

---

## Metrics to Track

1. **Similarity Quality**:
   - Do similar players have similar career outcomes?
   - Are results interpretable (can we explain why players are similar)?

2. **Performance**:
   - Query response time
   - Memory usage
   - Cache hit rate

3. **User Feedback**:
   - Do users find similar players relevant?
   - Are there common complaints about missing players?

---

## Next Steps

1. **Immediate**: Implement percentile normalization and era adjustment
2. **Short-term**: Add PCA + Cosine Similarity as alternative method
3. **Medium-term**: Implement clustering pre-filter
4. **Long-term**: Explore ML-based approaches if we have labeled data



