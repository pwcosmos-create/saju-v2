import random
import numpy as np

# --- Configuration ---
TARGET_STABILITY = 0.999  # DPSR Target (99.9%)
RL_EPISODES = 50000      # Episodes for Q-learning (50,000)
AL_EPISODES = 50000      # Simulations for active learning space search (50,000)
TOTAL_RUNS = RL_EPISODES + AL_EPISODES # Total 100,000 times!

# =====================================================================
# 1. Reinforcement Learning (Q-Learning) for Optimal Retry Decision
# =====================================================================
class QLearningRetryAgent:
    def __init__(self, max_attempts=5, lr=0.1, discount=0.9, epsilon=1.0, epsilon_decay=0.9995, min_epsilon=0.01):
        self.max_attempts = max_attempts
        self.lr = lr
        self.discount = discount
        self.epsilon = epsilon
        self.epsilon_decay = epsilon_decay
        self.min_epsilon = min_epsilon
        
        # State: current attempt index (0 to max_attempts-1)
        # Action: 0 = Abort (Give Up), 1 = Retry
        self.q_table = np.zeros((max_attempts, 2))

    def get_action(self, state):
        if random.random() < self.epsilon:
            return random.choice([0, 1])  # Explore
        return np.argmax(self.q_table[state])  # Exploit

    def update_q_table(self, state, action, reward, next_state, done):
        best_next_action = np.argmax(self.q_table[next_state]) if not done else 0
        target = reward + (0 if done else self.discount * self.q_table[next_state, best_next_action])
        self.q_table[state, action] += self.lr * (target - self.q_table[state, action])

    def decay_epsilon(self):
        self.epsilon = max(self.min_epsilon, self.epsilon * self.epsilon_decay)

def run_reinforcement_learning_simulation(failure_rate=0.15):
    print("\n[Part 1] Running 50,000 Reinforcement Learning (Q-learning) Episodes...")
    max_retries = 3
    agent = QLearningRetryAgent(max_attempts=max_retries)
    
    success_count = 0
    total_retries_made = 0
    rewards_history = []
    
    for episode in range(RL_EPISODES):
        state = 0 # Start at attempt 0
        done = False
        episode_reward = 0
        
        while not done:
            action = agent.get_action(state)
            
            if action == 0: # Abort
                reward = -8.0 # High penalty for giving up early
                done = True
                next_state = state
                agent.update_q_table(state, action, reward, next_state, done)
                episode_reward += reward
            else: # Retry (try connection)
                total_retries_made += 1
                # Simulate network attempt
                success = random.random() >= failure_rate
                latency = random.uniform(0.1, 0.5) if success else 1.0 # 1s timeout penalty for failure
                
                if success:
                    reward = 10.0 - (latency * 2.0) # Reward for success, slightly reduced by latency
                    success_count += 1
                    done = True
                    next_state = state
                    agent.update_q_table(state, action, reward, next_state, done)
                    episode_reward += reward
                else:
                    if state == max_retries - 1: # Last attempt failed
                        reward = -20.0 # Huge penalty for critical failure
                        done = True
                        next_state = state
                        agent.update_q_table(state, action, reward, next_state, done)
                        episode_reward += reward
                    else: # Can try again
                        reward = -1.0 - latency # Latency + retry penalty
                        next_state = state + 1
                        agent.update_q_table(state, action, reward, next_state, done)
                        episode_reward += reward
                        state = next_state
        
        rewards_history.append(episode_reward)
        agent.decay_epsilon()
        
    print("\n--- RL Q-Learning Final Q-Table ---")
    print("State (Attempt) | Action: Abort | Action: Retry")
    for i in range(max_retries):
        print(f"    Attempt {i+1}   |    {self_round(agent.q_table[i, 0])}    |    {self_round(agent.q_table[i, 1])}")
        
    optimal_policy = []
    for i in range(max_retries):
        policy_action = "Retry" if np.argmax(agent.q_table[i]) == 1 else "Abort"
        optimal_policy.append(policy_action)
        
    print(f"Optimal Policy Learned: {optimal_policy}")
    print(f"Empirical DPSR (Success Rate): {success_count / RL_EPISODES * 100:.3f}%")
    print(f"Average Retries per stream request: {total_retries_made / RL_EPISODES:.2f}")
    return agent

def self_round(val):
    return f"{val:.3f}" if val != 0 else " 0.000"

# =====================================================================
# 2. Active Learning for Finding DPSR Stability Boundaries
# =====================================================================
def simulate_dpsr(max_retries, failure_rate, sample_runs=1000):
    successes = 0
    for _ in range(sample_runs):
        for attempt in range(max_retries):
            if random.random() >= failure_rate:
                successes += 1
                break
    return successes / sample_runs

def run_active_learning_simulation():
    print("\n[Part 2] Running 50,000 Active Learning Space Search Episodes...")
    # Active learning goal: Find the exact boundary (max failure_rate) where DPSR >= 99.9%
    # across retry configurations (max_retries = 1 to 5).
    # We actively query configurations with high uncertainty.
    
    retry_options = [1, 2, 3, 4, 5]
    boundary_results = {}
    
    # Active Learning Loop
    for max_retries in retry_options:
        # We perform search on failure rate between 0.0001 (0.01%) and 0.50 (50%)
        low_fr = 0.0001
        high_fr = 0.50
        
        # 10,000 runs per retry option (5 options * 10,000 = 50,000 total runs)
        # We actively update bounds (Binary Search / Active Querying near 0.999 boundary)
        queries = 10  # 10 steps of active refinement
        samples_per_query = 1000 # 1000 simulations per query
        
        for q in range(queries):
            mid_fr = (low_fr + high_fr) / 2
            dpsr = simulate_dpsr(max_retries, mid_fr, sample_runs=samples_per_query)
            
            # Active Selection: if DPSR is close to 0.999, we query more around this region.
            if dpsr >= TARGET_STABILITY:
                # Can tolerate higher failure rate, push lower bound up
                low_fr = mid_fr
            else:
                # Too unstable, push upper bound down
                high_fr = mid_fr
                
        # Final evaluation at the discovered boundary
        boundary_fr = low_fr
        stable_dpsr = simulate_dpsr(max_retries, boundary_fr, sample_runs=10000)
        boundary_results[max_retries] = (boundary_fr, stable_dpsr)
        
    print("\n--- Active Learning DPSR Stability Boundary Report ---")
    print(f"Goal: Achieve DPSR >= {TARGET_STABILITY * 100:.1f}%")
    print("Retry Limit | Max Allowed Network Error Rate | Empirical DPSR")
    print("------------|-------------------------------|----------------")
    for max_retries, (max_fr, dpsr) in boundary_results.items():
        print(f"     {max_retries}      |             {max_fr * 100:6.3f}%            |     {dpsr * 100:.3f}%")
        
    return boundary_results

# =====================================================================
# Main Run Execution
# =====================================================================
if __name__ == "__main__":
    print("=====================================================================")
    print("100,000 Runs Stream Stability Q-Learning & Active Learning Simulation")
    print("=====================================================================")
    
    # 1. Reinforcement Learning
    run_reinforcement_learning_simulation(failure_rate=0.15)
    
    # 2. Active Learning
    run_active_learning_simulation()
    
    print("\n=====================================================================")
    print("Simulation Complete!")
    print("=====================================================================")
